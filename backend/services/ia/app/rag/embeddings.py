from functools import lru_cache
from typing import List

import numpy as np

from app.core.config import get_settings


class EmbeddingService:
    """Service d'embeddings. Utilise sentence-transformers si disponible,
    sinon un fallback hash-based pour demarrer sans dependance lourde.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._dim = 384
        self._backend = "hash"

    def load(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.settings.embedding_model)
            self._dim = self._model.get_sentence_embedding_dimension()
            self._backend = "sentence-transformers"
        except Exception:
            # Fallback leger (dev / CI sans GPU / sans model download)
            self._model = None
            self._backend = "hash"
            self._dim = 384

    @property
    def dimension(self) -> int:
        return self._dim

    @property
    def backend(self) -> str:
        return self._backend

    def embed(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self._dim), dtype=np.float32)

        if self._model is not None:
            vectors = self._model.encode(
                texts,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return vectors.astype(np.float32)

        return np.vstack([self._hash_embed(t) for t in texts])

    def embed_one(self, text: str) -> np.ndarray:
        return self.embed([text])[0]

    def _hash_embed(self, text: str) -> np.ndarray:
        """Embedding deterministe simple pour mode offline / tests."""
        vec = np.zeros(self._dim, dtype=np.float32)
        tokens = text.lower().split()
        if not tokens:
            return vec
        for i, tok in enumerate(tokens):
            h = hash(tok) % self._dim
            vec[h] += 1.0 + (i % 7) * 0.01
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec


@lru_cache
def get_embedding_service() -> EmbeddingService:
    svc = EmbeddingService()
    svc.load()
    return svc
