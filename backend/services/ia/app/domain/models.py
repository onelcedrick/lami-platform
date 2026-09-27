from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================
# Rôles et messages
# ============================================================

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


# ============================================================
# Requêtes / Réponses de chat
# ============================================================

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    mode: str = Field(
        default="auto",
        description="auto | support | commerce | general",
    )


class SourceDocument(BaseModel):
    id: str
    title: str
    content: str
    score: float
    metadata: dict[str, Any] = {}


class ToolCallResult(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: Any


class ProductCard(BaseModel):
    """Produit à afficher en card dans le chat."""
    id: str
    name: str
    brand: str
    price: float
    stock: int
    image: Optional[str] = None
    slug: Optional[str] = None
    rating: Optional[float] = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    mode: str
    sources: list[SourceDocument] = []
    tool_calls: list[ToolCallResult] = []
    products: list[ProductCard] = []   # ✅ AJOUT
    latency_ms: int = 0


# ============================================================
# Base de connaissance (RAG)
# ============================================================

class KnowledgeDocument(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    category: str = "general"
    tags: list[str] = []
    source: str = "manual"
    metadata: dict[str, Any] = {}
    created_at: Optional[datetime] = None


class IngestRequest(BaseModel):
    documents: list[KnowledgeDocument]


class IngestResponse(BaseModel):
    ingested: int
    ids: list[str]


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    category: Optional[str] = None


class HealthResponse(BaseModel):
    service: str = "ia"
    status: str = "healthy"
    llm_provider: str
    embedding_model: str
    documents_count: int = 0


# ============================================================
# Historique de chat
# ============================================================

class ConversationMessage(BaseModel):
    """Un message dans une conversation."""
    id: str
    role: MessageRole
    content: str
    mode: Optional[str] = None
    sources: list[SourceDocument] = []
    tool_calls: list[ToolCallResult] = []
    cart_added: int = 0
    latency_ms: int = 0
    created_at: datetime


class Conversation(BaseModel):
    """Une conversation complète."""
    id: str
    user_id: Optional[str] = None            # None = anonyme
    session_id: Optional[str] = None         # Pour les anonymes (cookie)
    title: str = "Nouvelle conversation"     # Auto-généré du 1er message
    mode: str = "auto"
    message_count: int = 0
    last_message_at: datetime
    created_at: datetime
    expires_at: Optional[datetime] = None    # TTL 30 jours


class ConversationSummary(BaseModel):
    """Vue courte pour la liste."""
    id: str
    title: str
    mode: str
    message_count: int
    last_message_at: datetime
    created_at: datetime


class ConversationDetail(BaseModel):
    """Vue complète avec messages."""
    id: str
    title: str
    mode: str
    messages: list[ConversationMessage]
    created_at: datetime
    last_message_at: datetime


class RenameConversationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
