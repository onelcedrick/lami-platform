from typing import Optional

from app.core.config import get_settings
from app.domain.models import SourceDocument
from app.rag.vector_store import VectorStore, get_vector_store


class RAGPipeline:
    """Pipeline RAG : retrieval + construction du contexte."""

    def __init__(self, store: VectorStore) -> None:
        self.store = store
        self.settings = get_settings()

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        category: Optional[str] = None,
    ) -> list[SourceDocument]:
        k = top_k or self.settings.rag_top_k
        return await self.store.search(
            query=query,
            top_k=k,
            category=category,
            threshold=self.settings.rag_similarity_threshold,
        )

    def build_context(self, sources: list[SourceDocument]) -> str:
        if not sources:
            return ""

        parts: list[str] = []
        total = 0
        max_chars = self.settings.max_context_chars

        for i, src in enumerate(sources, 1):
            block = f"[{i}] {src.title}\n{src.content}"
            if total + len(block) > max_chars:
                remaining = max_chars - total
                if remaining > 100:
                    parts.append(block[:remaining] + "...")
                break
            parts.append(block)
            total += len(block)

        return "\n\n---\n\n".join(parts)

    def build_support_prompt(self, query: str, context: str) -> str:
        if not context:
            return (
                "Tu es l'assistant technique de la plateforme L'AMI "
                "(composants PC, configuration, depannage).\n"
                "Aucune documentation pertinente n'a ete trouvee dans la base.\n"
                "Reponds honnetement en francais, et propose de creer un ticket "
                "si le probleme est complexe.\n\n"
                f"Question client : {query}"
            )

        return (
            "Tu es l'assistant technique de la plateforme L'AMI "
            "(composants PC, configuration, depannage).\n"
            "Utilise UNIQUEMENT le contexte fourni pour repondre.\n"
            "Si l'information n'est pas dans le contexte, dis-le clairement.\n"
            "Reponds en francais, de maniere precise et professionnelle.\n"
            "Cite les sources par leur numero [1], [2], etc. si pertinent.\n\n"
            f"=== CONTEXTE ===\n{context}\n=== FIN CONTEXTE ===\n\n"
            f"Question client : {query}"
        )


async def get_rag_pipeline() -> RAGPipeline:
    store = await get_vector_store()
    return RAGPipeline(store)
