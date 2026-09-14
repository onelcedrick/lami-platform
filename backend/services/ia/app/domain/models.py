from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


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


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    mode: str
    sources: list[SourceDocument] = []
    tool_calls: list[ToolCallResult] = []
    latency_ms: int = 0


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
