"""Client LLM (Groq) simplifié pour l'orchestrateur NLU."""

from __future__ import annotations
import logging
from typing import Optional, Any

import httpx

from app.core.config import get_settings
from app.domain.ports import LLMPort

logger = logging.getLogger("ia.llm")

class LLMClient(LLMPort):
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def provider_name(self) -> str:
        return "groq"

    async def generate(self, prompt: str, system: str = "") -> dict:
        """Retourne TOUJOURS un dictionnaire avec la clé 'content'."""
        key = self.settings.groq_api_key
        if not key:
            return {"content": "Erreur: Clé API manquante."}
            
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": self.settings.groq_model,
                        "messages": messages,
                        "temperature": 0.3,
                    }
                )
                res.raise_for_status()
                data = res.json()
                msg = data["choices"][0]["message"]
                # On renvoie TOUJOURS un dictionnaire
                return {"content": msg.get("content", "")}
                
        except Exception as e:
            logger.error(f"Erreur LLM: {e}")
            return {"content": "Désolé, le service de langage est momentanément indisponible."}

_llm: Optional[LLMClient] = None

def get_llm_client() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
