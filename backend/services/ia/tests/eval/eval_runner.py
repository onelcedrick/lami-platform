"""
Client HTTP pour interroger le service IA L'AMI.
Gère les timeouts, les erreurs réseau, et normalise la réponse.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import httpx

DEFAULT_BASE_URL = "http://localhost:8090"
DEFAULT_TIMEOUT = 60.0


class EvalRunner:
    """Client d'évaluation vers /api/v1/ia/chat."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        session_id: Optional[str] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session_id = session_id or "eval-session-001"
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "EvalRunner":
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            headers={
                "Content-Type": "application/json",
                "X-Session-Id": self.session_id,
            },
        )
        return self

    async def __aexit__(self, *args) -> None:
        if self.client:
            await self.client.aclose()

    async def health(self) -> dict:
        """Vérifie que le service est up."""
        assert self.client is not None
        try:
            r = await self.client.get("/api/v1/ia/health")
            r.raise_for_status()
            return r.json()
        except Exception as e:
            return {"error": str(e), "status": "down"}

    async def chat(
        self,
        message: str,
        mode: str = "auto",
        conversation_id: Optional[str] = None,
    ) -> tuple[dict, int, int]:
        """
        Envoie un message au service IA.
        Retourne (response_dict, latency_ms, http_status).
        """
        assert self.client is not None
        payload = {"message": message, "mode": mode}
        if conversation_id:
            payload["conversation_id"] = conversation_id

        start = time.perf_counter()
        try:
            r = await self.client.post("/api/v1/ia/chat", json=payload)
            latency_ms = int((time.perf_counter() - start) * 1000)
            http_status = r.status_code
            if r.status_code == 200:
                return r.json(), latency_ms, http_status
            # Erreur HTTP : on renvoie un dict vide
            return {"error": r.text[:500], "mode": "error"}, latency_ms, http_status
        except httpx.TimeoutException:
            latency_ms = int((time.perf_counter() - start) * 1000)
            return {"error": "timeout", "mode": "error"}, latency_ms, 0
        except Exception as e:
            latency_ms = int((time.perf_counter() - start) * 1000)
            return {"error": str(e), "mode": "error"}, latency_ms, 0