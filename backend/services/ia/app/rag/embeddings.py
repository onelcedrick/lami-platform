from functools import lru_cache
from typing import List
import os
import threading

import numpy as np

from app.core.config import get_settings


class EmbeddingService:
    """Service d'embeddings avec fallback robuste.

    Priorités :
    1. Si EMBEDDINGS_BACKEND=hash → force le mode hash (rapide, dev)
    2. Sinon essaye sentence-transformers avec un timeout
    3. Si timeout ou erreur → bascule sur hash automatiquement
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._dim = 384
        self._backend = "hash"

    def load(self) -> None:
        # ---------- Mode forcé par variable d'environnement ----------
        force = (os.getenv("EMBEDDINGS_BACKEND") or "").lower()
        if force in ("hash", "hashing", "simple"):
            self._set_hash()
            print("[embeddings] backend=hash (force par EMBEDDINGS_BACKEND)", flush=True)
            return

        # ---------- Tentative sentence-transformers avec TIMEOUT ----------
        timeout = float(os.getenv("EMBEDDINGS_LOAD_TIMEOUT", "20"))

        def _try_load(store: dict) -> None:
            try:
                from sentence_transformers import SentenceTransformer

                store["model"] = SentenceTransformer(self.settings.embedding_model)
                store["ok"] = True
            except Exception as e:
                store["error"] = str(e)
                store["ok"] = False

        result: dict = {"ok": False}
        thread = threading.Thread(target=_try_load, args=(result,), daemon=True)
        thread.start()
        thread.join(timeout=timeout)

        if thread.is_alive():
            print(
                f"[embeddings] TIMEOUT apres {timeout}s — fallback hash",
                flush=True,
            )
            self._set_hash()
            return

        if result.get("ok") and result.get("model") is not None:
            self._model = result["model"]
            self._dim = self._model.get_sentence_embedding_dimension()
            self._backend = "sentence-transformers"
            print(
                f"[embeddings] backend=sentence-transformers dim={self._dim}",
                flush=True,
            )
        else:
            print(
                f"[embeddings] erreur chargement ({result.get('error')}) — fallback hash",
                flush=True,
            )
            self._set_hash()

    def _set_hash(self) -> None:
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
        """Embedding déterministe simple (offline / fallback)."""
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