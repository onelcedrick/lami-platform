"""Ports (interfaces) — Clean Architecture / Hexagonal.

La logique metier ne depend que de ces abstractions,
pas de FastAPI, Groq ou MongoDB.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from app.domain.models import (
    ChatMessage,
    ProductCard,
    SourceDocument,
    ToolCallResult,
)


class LLMPort(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.4,
    ) -> str:
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...


class EmbeddingPort(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        ...

    @property
    @abstractmethod
    def backend(self) -> str:
        ...


class VectorStorePort(ABC):
    @abstractmethod
    async def upsert(self, docs: list[dict[str, Any]]) -> list[str]:
        ...

    @abstractmethod
    async def search(
        self,
        query_vector: list[float],
        top_k: int = 3,
        category: Optional[str] = None,
    ) -> list[SourceDocument]:
        ...

    @abstractmethod
    async def count(self) -> int:
        ...


class ToolPort(ABC):
    @abstractmethod
    def list_schemas(self) -> list[dict[str, Any]]:
        ...

    @abstractmethod
    async def execute(
        self,
        name: str,
        arguments: dict[str, Any],
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ToolCallResult:
        ...

    @abstractmethod
    def extract_products(self, tool_results: list[ToolCallResult]) -> list[ProductCard]:
        ...


class SessionPort(ABC):
    """Memoire conversationnelle courte (pending_build, etc.)."""

    @abstractmethod
    def get(self, conversation_id: str) -> dict[str, Any]:
        ...

    @abstractmethod
    def set(self, conversation_id: str, data: dict[str, Any]) -> None:
        ...

    @abstractmethod
    def update(self, conversation_id: str, **kwargs: Any) -> dict[str, Any]:
        ...

    @abstractmethod
    def clear_key(self, conversation_id: str, key: str) -> None:
        ...


class ChatHistoryPort(ABC):
    @abstractmethod
    async def get_or_create(
        self,
        conversation_id: Optional[str],
        user_id: Optional[str],
        session_id: Optional[str],
        mode: str,
    ) -> Any:
        ...

    @abstractmethod
    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        **meta: Any,
    ) -> None:
        ...
