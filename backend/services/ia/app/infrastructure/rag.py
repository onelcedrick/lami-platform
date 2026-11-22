"""Pipeline RAG : retrieve + build context + support prompt (EF-02)."""

from __future__ import annotations

from typing import Optional

from app.core.config import get_settings
from app.domain.models import SourceDocument
from app.infrastructure.vector_store import get_vector_store


class RAGPipeline:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        category: Optional[str] = None,
    ) -> list[SourceDocument]:
        store = await get_vector_store()
        k = top_k or self.settings.rag_top_k
        docs = await store.search(
            query,
            top_k=k,
            category=category,
            threshold=self.settings.rag_min_score,
        )
        return docs

    def build_context(self, sources: list[SourceDocument]) -> str:
        if not sources:
            return ""
        parts = []
        for i, s in enumerate(sources, 1):
            parts.append(f"[{i}] {s.title}\n{s.content[:800]}")
        return "\n\n".join(parts)

    def build_support_prompt(self, question: str, context: str) -> str:
        if not context:
            return (
                f"Question client : {question}\n\n"
                "Aucun document pertinent trouve dans la base. "
                "Demande des precisions ou propose un ticket support."
            )
        return (
            "Contexte technique L'AMI (utilise uniquement ces informations) :\n"
            f"{context}\n\n"
            f"Question client : {question}\n\n"
            "Reponds en francais, de facon concise et actionnable."
        )


_rag: Optional[RAGPipeline] = None


async def get_rag_pipeline() -> RAGPipeline:
    global _rag
    if _rag is None:
        _rag = RAGPipeline()
    return _rag
