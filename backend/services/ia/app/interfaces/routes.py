import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.application.orchestrator import get_orchestrator
from app.infrastructure.tools import get_tool_registry
from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user, require_user
from app.domain.models import (
    ChatRequest,
    ChatResponse,
    ConversationDetail,
    ConversationSummary,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    MessageRole,
    RenameConversationRequest,
    SearchRequest,
    SourceDocument,
)
from app.infrastructure.rag import get_rag_pipeline
from app.infrastructure.vector_store import get_vector_store
from app.application.chat_history import get_chat_history
from app.infrastructure.seed import seed_knowledge_base


logger = logging.getLogger("ia.routes")

CHAT_TIMEOUT_S = 25.0
FALLBACK_TIMEOUT = (
    "Le traitement a pris trop de temps. Votre message est bien enregistré ; "
    "reformulez-le ou réessayez dans un instant."
)
FALLBACK_ERROR = (
    "Une erreur interne est survenue. Votre message est bien enregistré ; "
    "réessayez dans un instant."
)


class _ConversationLocks:
    """Un verrou par conversation, avec comptage de references (pas de fuite)."""

    def __init__(self) -> None:
        self._locks: dict = {}
        self._refs: dict = {}
        self._guard = asyncio.Lock()

    @asynccontextmanager
    async def acquire(self, cid: str):
        async with self._guard:
            lk = self._locks.get(cid)
            if lk is None:
                lk = asyncio.Lock()
                self._locks[cid] = lk
            self._refs[cid] = self._refs.get(cid, 0) + 1
        try:
            async with lk:
                yield
        finally:
            async with self._guard:
                self._refs[cid] = self._refs.get(cid, 1) - 1
                if self._refs[cid] <= 0:
                    self._locks.pop(cid, None)
                    self._refs.pop(cid, None)


conv_locks = _ConversationLocks()

router = APIRouter()


# ============================================================
# Health
# ============================================================
@router.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    count = 0
    status = "healthy"
    try:
        store = await get_vector_store()
        count = await store.count()
    except Exception:
        # Mongo indisponible : on ne fait pas tomber le conteneur
        status = "degraded"
    return HealthResponse(
        status=status,
        llm_provider=settings.llm_provider,
        embedding_model=settings.embedding_model,
        documents_count=count,
    )


# ============================================================
# Chat
# ============================================================
@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: Optional[CurrentUser] = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id"),
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]

    uid = user.user_id if user else None
    sid = _session_id_from_header(x_session_id)

    history = await get_chat_history()
    conv = await history.get_or_create(
        conversation_id=body.conversation_id,
        user_id=uid, session_id=sid, mode=body.mode,
    )
    _check_ownership(conv, uid, sid)

    # G1 : le message utilisateur est durable AVANT tout appel LLM.
    # G5 : un rejeu du meme X-Request-Id ne cree pas de doublon.
    dup = await history.find_by_request_id(conv.id, x_request_id)
    if dup is None:
        await history.add_message(
            conversation_id=conv.id, role=MessageRole.USER,
            content=body.message, request_id=x_request_id,
        )

    t0 = time.perf_counter()
    orchestrator = get_orchestrator()
    response: Optional[ChatResponse] = None

    # Un seul tour LLM a la fois PAR conversation ; les conversations
    # differentes restent totalement paralleles.
    async with conv_locks.acquire(conv.id):
        try:
            msgs = await history.get_recent_messages(conv.id, limit=8)
            history_text = "\n".join(f"{m.role.value}: {m.content}" for m in msgs)
        except Exception as exc:
            logger.warning("Historique illisible pour %s : %s", conv.id, exc)
            history_text = ""

        try:
            response = await asyncio.wait_for(
                orchestrator.handle(
                    message=body.message,
                    mode=body.mode,
                    conversation_id=conv.id,
                    auth_token=token,
                    user_id=uid,
                    context=body.context,
                    history=history_text,
                ),
                timeout=CHAT_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            logger.error("Timeout LLM sur conversation %s", conv.id)
            response = ChatResponse(
                conversation_id=conv.id, reply=FALLBACK_TIMEOUT,
                mode="general", intent="erreur",
                latency_ms=int((time.perf_counter() - t0) * 1000),
            )
        except Exception as exc:
            logger.exception("Echec orchestrateur sur %s : %s", conv.id, exc)
            response = ChatResponse(
                conversation_id=conv.id, reply=FALLBACK_ERROR,
                mode="general", intent="erreur",
                latency_ms=int((time.perf_counter() - t0) * 1000),
            )

    cart_added = 0
    for tc in response.tool_calls:
        if tc.name in ("add_to_cart", "add_build_to_cart") and isinstance(tc.result, dict):
            cart_added += int(tc.result.get("count") or 0)
    if response.cart_added == 0 and cart_added:
        response.cart_added = cart_added

    # G5 : la reponse assistant est TOUJOURS persistee, meme en cas d'echec.
    try:
        await history.add_message(
            conversation_id=conv.id, role=MessageRole.ASSISTANT,
            content=response.reply, mode=response.mode,
            sources=response.sources, tool_calls=response.tool_calls,
            cart_added=cart_added, latency_ms=response.latency_ms,
        )
    except Exception as exc:
        logger.error("Persistance assistant impossible (%s) : %s", conv.id, exc)

    return response


# ============================================================
# Configurateur PC
# ============================================================
@router.post("/configure")
async def configure_pc(
    body: dict,
    authorization: Optional[str] = Header(default=None),
):
    """Configurateur PC: usage + budget (Ar) -> composants catalogue."""
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]

    usage = body.get("usage") or "gaming"
    budget = body.get("budget") or 0

    registry = get_tool_registry()
    result = await registry.execute(
        "suggest_pc_build",
        {"usage": usage, "budget": budget},
        auth_token=token,
    )
    return {"success": True, "data": result}


# ============================================================
# RAG
# ============================================================
@router.post("/rag/search", response_model=list[SourceDocument])
async def rag_search(body: SearchRequest):
    rag = await get_rag_pipeline()
    return await rag.retrieve(
        query=body.query,
        top_k=body.limit,
        category=body.category,
    )


# ============================================================
# Base de connaissance
# ============================================================
@router.post("/knowledge/ingest", response_model=IngestResponse)
async def ingest_documents(
    body: IngestRequest,
    user: CurrentUser = Depends(require_user),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acces admin requis")
    store = await get_vector_store()
    ids = await store.ingest(body.documents)
    return IngestResponse(ingested=len(ids), ids=ids)


@router.get("/knowledge/documents")
async def list_documents(
    user: CurrentUser = Depends(require_user),
    limit: int = 50,
):
    if user.role not in ("admin", "super_admin", "technician"):
        raise HTTPException(status_code=403, detail="Acces refuse")
    store = await get_vector_store()
    docs = await store.list_documents(limit=limit)
    return {"success": True, "data": docs}


@router.delete("/knowledge/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user: CurrentUser = Depends(require_user),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acces admin requis")
    store = await get_vector_store()
    ok = await store.delete(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"success": True, "message": "Document supprime"}


@router.post("/knowledge/seed")
async def seed_kb(user: CurrentUser = Depends(require_user)):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acces admin requis")
    count = await seed_knowledge_base()
    return {"success": True, "message": f"{count} documents indexes"}


# ============================================================
# Outils (Function Calling)
# ============================================================
@router.get("/tools")
async def list_tools():
    registry = get_tool_registry()
    return {"success": True, "data": registry.list_schemas()}


# ============================================================
# Historique de chat
# ============================================================
def _session_id_from_header(x_session_id: Optional[str]) -> Optional[str]:
    """Recupere l'ID de session anonyme depuis le header."""
    return x_session_id if x_session_id else None


def _check_ownership(conv, user_id: Optional[str], session_id: Optional[str]) -> None:
    """Verifie que l'utilisateur (ou la session anonyme) est bien proprietaire."""
    if conv.user_id and conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Acces refuse")
    if not conv.user_id and conv.session_id and conv.session_id != session_id:
        raise HTTPException(status_code=403, detail="Acces refuse")


# IMPORTANT : les routes statiques doivent etre AVANT les routes dynamiques
@router.get("/conversations/stats/summary")
async def conversation_stats(
    user: CurrentUser = Depends(require_user),
):
    """Statistiques des conversations (admin uniquement)."""
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Acces admin requis")
    history = await get_chat_history()
    return {"success": True, "data": await history.get_stats()}


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    user: Optional[CurrentUser] = Depends(get_current_user),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id"),
):
    """Liste les conversations de l'utilisateur connecte ou de la session anonyme."""
    history = await get_chat_history()
    return await history.list_conversations(
        user_id=user.user_id if user else None,
        session_id=_session_id_from_header(x_session_id),
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user: Optional[CurrentUser] = Depends(get_current_user),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id"),
):
    """Detail d'une conversation (verifie la propriete)."""
    history = await get_chat_history()
    conv = await history.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    _check_ownership(
        conv,
        user.user_id if user else None,
        _session_id_from_header(x_session_id),
    )
    detail = await history.get_detail(conversation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    return detail


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: str,
    body: RenameConversationRequest,
    user: Optional[CurrentUser] = Depends(get_current_user),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id"),
):
    """Renomme une conversation."""
    history = await get_chat_history()
    conv = await history.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    _check_ownership(
        conv,
        user.user_id if user else None,
        _session_id_from_header(x_session_id),
    )
    ok = await history.rename_conversation(conversation_id, body.title)
    if not ok:
        raise HTTPException(status_code=400, detail="Renommage impossible")
    return {"success": True, "message": "Conversation renommee"}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: Optional[CurrentUser] = Depends(get_current_user),
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id"),
):
    """Supprime une conversation et ses messages."""
    history = await get_chat_history()
    conv = await history.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    _check_ownership(
        conv,
        user.user_id if user else None,
        _session_id_from_header(x_session_id),
    )
    await history.delete_conversation(conversation_id)
    return {"success": True, "message": "Conversation supprimee"}
