from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

import numpy as np
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.domain.models import KnowledgeDocument, SourceDocument
from app.rag.embeddings import EmbeddingService, get_embedding_service


class VectorStore:
    """Stockage documents + vecteurs dans MongoDB.
    Similarite cosine en memoire (suffisant pour volumes demo / Master).
    Pour production : MongoDB Atlas Vector Search.
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        embeddings: EmbeddingService,
    ) -> None:
        self.collection = db["knowledge_documents"]
        self.embeddings = embeddings
        self._cache: list[dict[str, Any]] = []
        self._cache_loaded = False

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("category")
        await self.collection.create_index("tags")
        await self.collection.create_index("title")

    async def _load_cache(self) -> None:
        if self._cache_loaded:
            return
        cursor = self.collection.find({})
        docs = await cursor.to_list(length=10000)
        self._cache = docs
        self._cache_loaded = True

    def invalidate_cache(self) -> None:
        self._cache_loaded = False
        self._cache = []

    async def count(self) -> int:
        return await self.collection.count_documents({})

    async def ingest(self, documents: list[KnowledgeDocument]) -> list[str]:
        if not documents:
            return []

        texts = [f"{d.title}\n{d.content}" for d in documents]
        vectors = self.embeddings.embed(texts)

        ids: list[str] = []
        now = datetime.now(timezone.utc)
        ops = []
        for doc, vec in zip(documents, vectors):
            doc_id = doc.id or str(uuid4())
            ids.append(doc_id)
            ops.append(
                {
                    "_id": doc_id,
                    "title": doc.title,
                    "content": doc.content,
                    "category": doc.category,
                    "tags": doc.tags,
                    "source": doc.source,
                    "metadata": doc.metadata,
                    "embedding": vec.tolist(),
                    "created_at": doc.created_at or now,
                    "updated_at": now,
                }
            )

        if ops:
            await self.collection.insert_many(ops)
            self.invalidate_cache()
        return ids

    async def search(
        self,
        query: str,
        top_k: int = 5,
        category: Optional[str] = None,
        threshold: float = 0.0,
    ) -> list[SourceDocument]:
        await self._load_cache()
        if not self._cache:
            return []

        query_vec = self.embeddings.embed_one(query)
        results: list[tuple[float, dict]] = []

        for doc in self._cache:
            if category and doc.get("category") != category:
                continue
            emb = doc.get("embedding")
            if not emb:
                continue
            doc_vec = np.array(emb, dtype=np.float32)
            score = float(np.dot(query_vec, doc_vec))
            if score >= threshold:
                results.append((score, doc))

        results.sort(key=lambda x: x[0], reverse=True)
        top = results[:top_k]

        return [
            SourceDocument(
                id=str(doc["_id"]),
                title=doc.get("title", ""),
                content=doc.get("content", ""),
                score=round(score, 4),
                metadata={
                    "category": doc.get("category"),
                    "tags": doc.get("tags", []),
                    "source": doc.get("source"),
                },
            )
            for score, doc in top
        ]

    async def delete(self, doc_id: str) -> bool:
        res = await self.collection.delete_one({"_id": doc_id})
        self.invalidate_cache()
        return res.deleted_count > 0

    async def list_documents(self, limit: int = 50) -> list[dict]:
        cursor = self.collection.find(
            {},
            {"embedding": 0},
        ).limit(limit)
        docs = await cursor.to_list(length=limit)
        for d in docs:
            d["id"] = str(d.pop("_id"))
        return docs


_vector_store: Optional[VectorStore] = None
_mongo_client: Optional[AsyncIOMotorClient] = None


async def get_vector_store() -> VectorStore:
    global _vector_store, _mongo_client
    if _vector_store is None:
        settings = get_settings()
        _mongo_client = AsyncIOMotorClient(settings.mongo_uri)
        db = _mongo_client[settings.mongo_db]
        _vector_store = VectorStore(db, get_embedding_service())
        await _vector_store.ensure_indexes()
    return _vector_store


async def close_vector_store() -> None:
    global _vector_store, _mongo_client
    if _mongo_client:
        _mongo_client.close()
    _vector_store = None
    _mongo_client = None
