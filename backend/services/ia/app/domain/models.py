"""Entites et DTO du domaine IA (Pydantic)."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class IntentMode(str, Enum):
    AUTO = "auto"
    SUPPORT = "support"
    COMMERCE = "commerce"
    GENERAL = "general"


class ChatMessage(BaseModel):
    role: MessageRole
    content: str
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


class ProductContext(BaseModel):
    id: str
    name: str
    brand: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None

class ChatContext(BaseModel):
    """Contexte envoye par le frontend (EF-04)."""
    intent: str = "general"
    product: Optional[ProductContext] = None


class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    mode: str = Field(default="auto", description="auto | support | commerce | general")
    context: Optional[ChatContext] = None
    recent_history: Optional[list[HistoryMessage]] = None  # ✅ Nouveau champ


class SourceDocument(BaseModel):
    id: str
    title: str
    content: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class ToolCallResult(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any = None


class ProductCard(BaseModel):
    id: str
    name: str
    brand: str = ""
    price: float = 0
    stock: int = 0
    image: Optional[str] = None
    slug: Optional[str] = None
    rating: Optional[float] = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    mode: str
    sources: list[SourceDocument] = Field(default_factory=list)
    tool_calls: list[ToolCallResult] = Field(default_factory=list)
    products: list[ProductCard] = Field(default_factory=list)
    cart_added: int = 0
    latency_ms: int = 0


class KnowledgeDocument(BaseModel):
    id: Optional[str] = None
    title: str
    content: str
    category: str = "general"
    tags: list[str] = Field(default_factory=list)
    source: str = "manual"
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None


class IngestRequest(BaseModel):
    documents: list[KnowledgeDocument]


class IngestResponse(BaseModel):
    ingested: int
    ids: list[str]


class HealthResponse(BaseModel):
    service: str = "ia"
    status: str = "healthy"
    llm_provider: str = ""
    embedding_model: str = ""
    documents_count: int = 0


# ============================================================
# Historique de chat
# ============================================================

class ConversationMessage(BaseModel):
    id: str
    role: MessageRole
    content: str
    mode: Optional[str] = None
    sources: list[SourceDocument] = Field(default_factory=list)
    tool_calls: list[ToolCallResult] = Field(default_factory=list)
    cart_added: int = 0
    latency_ms: int = 0
    created_at: datetime


class Conversation(BaseModel):
    id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    title: str = "Nouvelle conversation"
    mode: str = "auto"
    message_count: int = 0
    last_message_at: datetime
    created_at: datetime
    expires_at: Optional[datetime] = None


class ConversationSummary(BaseModel):
    id: str
    title: str
    mode: str
    message_count: int
    last_message_at: datetime
    created_at: datetime


class ConversationDetail(BaseModel):
    id: str
    title: str
    mode: str
    messages: list[ConversationMessage]
    created_at: datetime
    last_message_at: datetime


class RenameConversationRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    category: Optional[str] = None
