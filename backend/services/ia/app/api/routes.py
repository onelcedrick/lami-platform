from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.agent.orchestrator import get_orchestrator
from app.agent.tools import get_tool_registry
from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user, require_user
from app.domain.models import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    SearchRequest,
    SourceDocument,
)
from app.rag.pipeline import get_rag_pipeline
from app.rag.vector_store import get_vector_store
from app.services.seed import seed_knowledge_base

router = APIRouter()


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


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: Optional[CurrentUser] = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
):
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]

    orchestrator = get_orchestrator()
    return await orchestrator.handle(
        message=body.message,
        mode=body.mode,
        conversation_id=body.conversation_id,
        auth_token=token,
        user_id=user.user_id if user else None,
    )


@router.post("/rag/search", response_model=list[SourceDocument])
async def rag_search(body: SearchRequest):
    rag = await get_rag_pipeline()
    return await rag.retrieve(
        query=body.query,
        top_k=body.top_k,
        category=body.category,
    )


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


@router.get("/tools")
async def list_tools():
    registry = get_tool_registry()
    return {"success": True, "data": registry.list_schemas()}
