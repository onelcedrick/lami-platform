from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.agent.orchestrator import get_orchestrator
from app.agent.tools import get_tool_registry
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
from app.rag.pipeline import get_rag_pipeline
from app.rag.vector_store import get_vector_store
from app.services.chat_history import get_chat_history
from app.services.seed import seed_knowledge_base

router = APIRouter()


# ============================================================
# Health
# ============================================================

@router.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    store = await get_vector_store()
    count = await store.count()
    return HealthResponse(
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
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]

    # ✅ Historique : récupère ou crée la conversation
    history = await get_chat_history()
    conv = await history.get_or_create(
        conversation_id=body.conversation_id,
        user_id=user.user_id if user else None,
        session_id=_session_id_from_header(x_session_id),
        mode=body.mode,
    )

    # ✅ Sauvegarde du message utilisateur
    await history.add_message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=body.message,
    )

    # Appel orchestrateur
    orchestrator = get_orchestrator()
    response = await orchestrator.handle(
        message=body.message,
        mode=body.mode,
        conversation_id=conv.id,
        auth_token=token,
        user_id=user.user_id if user else None,
    )

    # ✅ Calcul du nombre d'articles ajoutés au panier
    cart_added = 0
    for tc in response.tool_calls:
        if tc.name in ("add_to_cart", "add_build_to_cart"):
            if isinstance(tc.result, dict):
                cart_added += tc.result.get("count", 0)

    # ✅ Sauvegarde de la réponse assistant
    await history.add_message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=response.reply,
        mode=response.mode,
        sources=response.sources,
        tool_calls=response.tool_calls,
        cart_added=cart_added,
        latency_ms=response.latency_ms,
    )

    return response


# ============================================================
# Configurateur PC
# ============================================================

@router.post("/configure")
async def configure_pc(
    body: dict,
    authorization: Optional[str] = Header(default=None),
):
    """Configurateur PC: usage + budget (Ar) → composants catalogue."""
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
        top_k=body.top_k,
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
    """Récupère l'ID de session anonyme depuis le header."""
    return x_session_id if x_session_id else None


def _check_ownership(conv, user_id: Optional[str], session_id: Optional[str]) -> None:
    """Vérifie que l'utilisateur (ou la session anonyme) est bien propriétaire."""
    if conv.user_id and conv.user_id != user_id:
        raise HTTPException(status_code=403, detail="Acces refuse")
    if not conv.user_id and conv.session_id and conv.session_id != session_id:
        raise HTTPException(status_code=403, detail="Acces refuse")


# ⚠️ IMPORTANT : les routes statiques doivent être AVANT les routes dynamiques
# Sinon "/conversations/stats/summary" serait interprété comme un {conversation_id}
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
    """Liste les conversations de l'utilisateur connecté ou de la session anonyme."""
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
    """Détail d'une conversation (vérifie la propriété)."""
    history = await get_chat_history()
    detail = await history.get_detail(conversation_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    conv = await history.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    _check_ownership(
        conv,
        user.user_id if user else None,
        _session_id_from_header(x_session_id),
    )
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
