"""
Abstraction LLM : mock (defaut), Ollama, ou API OpenAI-compatible.
"""

from typing import Any, Optional

import httpx

from app.core.config import get_settings


class LLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        provider = self.settings.llm_provider.lower()

        if provider == "ollama":
            return await self._ollama(prompt, system, temperature)
        if provider in ("openai", "openai_compatible"):
            return await self._openai(prompt, system, temperature, max_tokens)
        return self._mock(prompt, system)

    async def _ollama(
        self,
        prompt: str,
        system: Optional[str],
        temperature: float,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.settings.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.settings.ollama_base_url}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()

    async def _openai(
        self,
        prompt: str,
        system: Optional[str],
        temperature: float,
        max_tokens: int,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.settings.openai_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self.settings.openai_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    def _mock(self, prompt: str, system: Optional[str] = None) -> str:
        """Reponse deterministe pour demo sans LLM externe."""
        lower = prompt.lower()

        if "contexte" in lower or "===" in prompt:
            # Mode RAG : extraire un resume approximatif
            if "aucune documentation" in lower or "pas ete trouvee" in lower:
                return (
                    "Je n'ai pas trouve d'information precise dans la base de "
                    "connaissances pour cette question. "
                    "Pouvez-vous preciser le modele du composant ou le message "
                    "d'erreur exact ? Je peux aussi creer un ticket support "
                    "pour qu'un technicien prenne le relais."
                )
            return (
                "D'apres la documentation technique disponible :\n\n"
                "Les informations retrouvees dans la base de connaissances "
                "indiquent une procedure standard de diagnostic. "
                "Verifiez d'abord l'alimentation, les branchements et les "
                "derniers pilotes. Si le probleme persiste, je vous recommande "
                "de creer un ticket avec les details (modele, message d'erreur, photos).\n\n"
                "Sources utilisees : documentation interne L'AMI."
            )

        if any(w in lower for w in ["pc", "config", "budget", "gaming", "montage"]):
            return (
                "Je peux vous aider a configurer un PC. "
                "Indiquez-moi votre usage principal (gaming, bureautique, "
                "montage video...) et votre budget approximatif en euros. "
                "Je consulterai le catalogue pour vous proposer une configuration compatible."
            )

        if any(w in lower for w in ["produit", "prix", "carte graphique", "processeur", "ram"]):
            return (
                "Je vais rechercher dans le catalogue L'AMI les produits "
                "correspondant a votre demande. "
                "Precisez marque, gamme ou budget si possible pour affiner."
            )

        if any(w in lower for w in ["ticket", "panne", "erreur", "probleme", "aide"]):
            return (
                "Je suis la pour le support technique. "
                "Decrivez le symptome (ecran bleu, pas de signal, surchauffe...), "
                "le materiel concerne et ce que vous avez deja tente. "
                "Si necessaire, je creerai un ticket pour un technicien."
            )

        return (
            "Bonjour, je suis l'assistant L'AMI. "
            "Je peux vous aider pour :\n"
            "- Le support technique (diagnostic, guides)\n"
            "- La recherche de composants et configurations PC\n"
            "- La creation de tickets support\n\n"
            "Que souhaitez-vous faire ?"
        )


_llm: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
