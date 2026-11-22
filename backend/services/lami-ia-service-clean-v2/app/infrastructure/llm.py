"""Client LLM (Groq / OpenAI) avec fallback (ENF-02)."""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import get_settings
from app.domain.ports import LLMPort

logger = logging.getLogger("ia.llm")


class LLMClient(LLMPort):
    def __init__(self) -> None:
        self.settings = get_settings()
        self._provider = (self.settings.llm_provider or "groq").lower()

    @property
    def provider_name(self) -> str:
        return self._provider

    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.4,
    ) -> str:
        try:
            if self._provider == "mock":
                return self._fallback(prompt, reason="mock")
            if self._provider == "openai":
                return await self._openai(prompt, system, temperature)
            return await self._groq(prompt, system, temperature)
        except Exception as exc:
            logger.warning("LLM indisponible (%s) — fallback", exc)
            return self._fallback(prompt, reason=str(exc))

    async def _groq(self, prompt: str, system: str, temperature: float) -> str:
        key = self.settings.groq_api_key
        if not key:
            return self._fallback(prompt, reason="GROQ_API_KEY manquante")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout_s) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.groq_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": self.settings.llm_max_tokens,
                },
            )
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()

    async def _openai(self, prompt: str, system: str, temperature: float) -> str:
        key = self.settings.openai_api_key
        if not key:
            return self._fallback(prompt, reason="OPENAI_API_KEY manquante")
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout_s) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.openai_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": self.settings.llm_max_tokens,
                },
            )
            res.raise_for_status()
            data = res.json()
            return data["choices"][0]["message"]["content"].strip()

    def _fallback(self, prompt: str, reason: str = "") -> str:
        """Mode degrade (ENF-02) — pas d'erreur 500."""
        lower = (prompt or "").lower()
        if any(w in lower for w in ("pc", "config", "budget", "gaming", "bureautique")):
            return (
                "Je peux vous proposer une configuration PC. "
                "Indiquez usage (gaming, bureautique, creation) et budget en Ariary "
                "(ex: 2 000 000 Ar). "
                f"{'(Service LLM temporairement limite.)' if reason else ''}"
            )
        if any(w in lower for w in ("panne", "erreur", "probleme", "bsod", "surchauffe")):
            return (
                "Pour le diagnostic, precisez le symptome, le materiel et les messages d'erreur. "
                "Je peux aussi creer un ticket support pour un technicien L'AMI."
            )
        if any(w in lower for w in ("produit", "prix", "ram", "cpu", "gpu", "ssd")):
            return (
                "Je recherche dans le catalogue L'AMI. "
                "Precisez marque, type de composant ou budget pour affiner."
            )
        return (
            "Bonjour, je suis l'assistant L'AMI. "
            "Je peux vous aider pour le support technique, "
            "la recherche de composants et les configurations PC sous budget. "
            "Que souhaitez-vous faire ?"
        )


_llm: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
