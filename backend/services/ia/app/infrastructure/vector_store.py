"""
Stockage documents + vecteurs dans MongoDB.

Recherche HYBRIDE :
  score = 0.55 * cosinus(MiniLM) + 0.45 * score_lexical

Le score lexical combine :
  - couverture IDF des tokens de la requete (les termes rares pesent plus)
  - bonus si le terme est dans le titre
  - bonus bigrammes (expressions consecutives : "mode sans echec", "ne s allume")

Justification : sur une base de 10 documents, le cosinus seul confond des
procédures proches (BSOD / pas de signal / demarrage). Le signal lexical
exact departage les cas ou le mot technique est discriminant.
"""
from __future__ import annotations

import logging
import math
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

import numpy as np
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.domain.models import KnowledgeDocument, SourceDocument
from app.infrastructure.embeddings import EmbeddingService, get_embedding_service

logger = logging.getLogger("ia.rag")

SEMANTIC_WEIGHT = 0.55
LEXICAL_WEIGHT = 0.45
COVERAGE_SHARE = 0.60
TITLE_SHARE = 0.10
BIGRAM_SHARE = 0.30
MIN_COSINE = 0.08

STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "a", "au", "aux",
    "et", "ou", "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui",
    "quoi", "quel", "quelle", "quels", "quelles", "comment", "pourquoi", "est",
    "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son",
    "sa", "ses", "je", "j", "tu", "il", "elle", "on", "nous", "vous", "ils",
    "ne", "pas", "plus", "moins", "tres", "tout", "toute", "tous", "se", "s",
    "y", "the", "is", "at", "of", "and", "to", "in", "it", "be", "as",
}


def _norm(text: Any) -> str:
    s = str(text or "").lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("-", " ").replace("/", " ").replace("_", " ").replace("'", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _query_tokens(text: str) -> list[str]:
    out: list[str] = []
    for t in _norm(text).split():
        if len(t) < 2 or t in STOPWORDS:
            continue
        if t.isdigit() and len(t) < 3:
            continue
        if t not in out:
            out.append(t)
    return out


def _stem(t: str) -> str:
    return t[:6] if len(t) >= 6 else t


def _bigrams(text: str) -> list[str]:
    toks = _norm(text).split()
    return [f"{toks[i]} {toks[i + 1]}" for i in range(len(toks) - 1)]


class VectorStore:
    """Stockage documents + vecteurs, recherche hybride en memoire."""

    def __init__(self, db: AsyncIOMotorDatabase, embeddings: EmbeddingService) -> None:
        self.collection = db["knowledge_documents"]
        self.embeddings = embeddings
        self._cache: list[dict[str, Any]] = []
        self._cache_loaded = False
        self._texts: list[str] = []
        self._titles: list[str] = []
        self._df: dict[str, int] = {}
        self._n = 1

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("category")
        await self.collection.create_index("tags")
        await self.collection.create_index("title")

    # ------------------------------------------------------------
    async def _load_cache(self) -> None:
        if self._cache_loaded:
            return
        docs = await self.collection.find({}).to_list(length=10000)
        self._cache = docs
        self._build_lex_index()
        self._cache_loaded = True

    def _build_lex_index(self) -> None:
        self._texts, self._titles = [], []
        df: dict[str, int] = {}
        for doc in self._cache:
            tags = doc.get("tags") or []
            tags_txt = " ".join(str(t) for t in tags) if isinstance(tags, list) else ""
            title = _norm(doc.get("title"))
            body = _norm(" ".join([
                str(doc.get("title") or ""),
                str(doc.get("content") or ""),
                str(doc.get("category") or ""),
                tags_txt,
            ]))
            self._titles.append(title)
            self._texts.append(body)
            for t in set(body.split()):
                df[t] = df.get(t, 0) + 1
        self._df = df
        self._n = max(len(self._cache), 1)

    def invalidate_cache(self) -> None:
        self._cache_loaded = False
        self._cache = []
        self._texts, self._titles, self._df = [], [], {}

    async def count(self) -> int:
        return await self.collection.count_documents({})

    # ------------------------------------------------------------
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
            ops.append({
                "_id": doc_id,
                "title": doc.title,
                "content": doc.content,
                "category": doc.category,
                "tags": doc.tags,
                "source": doc.source,
                "metadata": doc.metadata,
                "embedding": vec.tolist(),
                "embedding_backend": self.embeddings.backend,
                "embedding_dim": int(self.embeddings.dimension),
                "created_at": doc.created_at or now,
                "updated_at": now,
            })
        if ops:
            await self.collection.insert_many(ops)
        self.invalidate_cache()
        return ids

    # ------------------------------------------------------------
    def _idf(self, stem: str) -> tuple[int, float]:
        df = sum(c for t, c in self._df.items() if t.startswith(stem))
        if df == 0:
            return 0, 0.0
        return df, math.log(1.0 + self._n / df)

    def _lexical(self, idx: int, qtoks: list[tuple[str, float]],
                 bigrams: list[str]) -> tuple[float, dict]:
        if not qtoks:
            return 0.0, {"coverage": 0.0, "title": 0.0, "bigram": 0.0}
        text = self._texts[idx]
        title = self._titles[idx]
        total = sum(w for _, w in qtoks) or 1.0
        hit = 0.0
        thit = 0
        for stem, w in qtoks:
            pat = rf"\b{re.escape(stem)}"
            if re.search(pat, text):
                hit += w
            if re.search(pat, title):
                thit += 1
        coverage = hit / total
        title_ratio = thit / len(qtoks)
        if bigrams:
            bh = sum(1 for b in bigrams if b in text)
            bigram_ratio = bh / len(bigrams)
        else:
            bigram_ratio = 0.0
        score = (COVERAGE_SHARE * coverage
                 + TITLE_SHARE * title_ratio
                 + BIGRAM_SHARE * bigram_ratio)
        return min(1.0, score), {
            "coverage": round(coverage, 4),
            "title": round(title_ratio, 4),
            "bigram": round(bigram_ratio, 4),
        }

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
        raw_tokens = _query_tokens(query)
        bigrams = _bigrams(query)

        qtoks: list[tuple[str, float]] = []
        for t in raw_tokens:
            stem = _stem(t)
            df, idf = self._idf(stem)
            if df > 0:
                qtoks.append((stem, idf))

        scored: list[tuple[float, float, float, dict, dict]] = []
        for i, doc in enumerate(self._cache):
            if category and doc.get("category") != category:
                continue
            emb = doc.get("embedding")
            if not emb:
                continue
            vec = np.asarray(emb, dtype=np.float32)
            if vec.shape != query_vec.shape:
                continue
            cos = float(np.dot(query_vec, vec))
            if cos < MIN_COSINE:
                continue
            lex, parts = self._lexical(i, qtoks, bigrams)
            hybrid = SEMANTIC_WEIGHT * cos + LEXICAL_WEIGHT * lex
            scored.append((hybrid, cos, lex, parts, doc))

        if not scored:
            return []

        scored.sort(key=lambda x: x[0], reverse=True)
        kept = [s for s in scored if s[0] >= threshold]
        if not kept:
            kept = scored[:1]  # garantit au moins une source
        kept = kept[:max(1, int(top_k))]

        out: list[SourceDocument] = []
        for hybrid, cos, lex, parts, doc in kept:
            out.append(SourceDocument(
                id=str(doc["_id"]),
                title=doc.get("title", ""),
                content=doc.get("content", ""),
                score=round(hybrid, 4),
                metadata={
                    "category": doc.get("category"),
                    "tags": doc.get("tags", []),
                    "source": doc.get("source"),
                    "semantic": round(cos, 4),
                    "lexical": round(lex, 4),
                    "lexical_parts": parts,
                },
            ))
        return out

    # ------------------------------------------------------------
    async def delete(self, doc_id: str) -> bool:
        res = await self.collection.delete_one({"_id": doc_id})
        self.invalidate_cache()
        return res.deleted_count > 0

    async def list_documents(self, limit: int = 50) -> list[dict]:
        cursor = self.collection.find({}, {"embedding": 0}).limit(limit)
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
