"""
AgentOrchestrator — cerveau du service IA (Strategy Pattern).

EF-01 Routage Support / Commerce / General
EF-02 RAG support
EF-03 Function calling
EF-04 Context produit frontend
EF-05 Memoire pending_build
EF-06 cart_added vers frontend
"""

from __future__ import annotations

import re
import time
from typing import Any, Optional
from uuid import uuid4

from app.application.session_store import get_session_store
from app.core.config import get_settings
from app.domain.models import (
    ChatContext,
    ChatResponse,
    ProductCard,
    SourceDocument,
    ToolCallResult,
)
from app.infrastructure.llm import get_llm_client
from app.infrastructure.rag import get_rag_pipeline
from app.infrastructure.tools import get_tool_registry

SUPPORT_KEYWORDS = [
    "panne", "erreur", "ecran bleu", "bsod", "ne demarre", "surchauffe",
    "driver", "bios", "probleme", "bug", "diagnostic", "reparer",
    "installer", "pilote", "overheating", "pas de signal", "ticket",
]

COMMERCE_KEYWORDS = [
    "acheter", "prix", "budget", "recommande", "configuration", "configurer",
    "pc pour", "carte graphique", "processeur", "meilleur", "combien",
    "disponible", "stock", "commander", "produit", "gaming", "montage",
    "panier", "ariary", "ajoute", "composant", "ram", "ssd", "cpu", "gpu",
]

CATEGORY_MAP = {
    "cpu": "CPU", "processeur": "CPU",
    "gpu": "GPU", "carte graphique": "GPU",
    "ram": "RAM", "memoire": "RAM",
    "ssd": "Stockage", "nvme": "Stockage", "hdd": "Stockage", "stockage": "Stockage",
    "alimentation": "Alimentation", "psu": "Alimentation",
    "carte mere": "Carte mere", "motherboard": "Carte mere",
    "boitier": "Boitier",
}


class AgentOrchestrator:
    """Orchestrateur central (Strategy + Registry)."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.llm = get_llm_client()
        self.tools = get_tool_registry()
        self.sessions = get_session_store()

    async def handle(
        self,
        message: str,
        mode: str = "auto",
        conversation_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
        context: Optional[ChatContext] = None,
    ) -> ChatResponse:
        t0 = time.perf_counter()
        conv_id = conversation_id or str(uuid4())
        detected = self.detect_mode(message, mode)

        sources: list[SourceDocument] = []
        tool_results: list[ToolCallResult] = []
        products: list[ProductCard] = []
        reply = ""

        # EF-04 : contexte produit prioritaire
        if context and context.product_id:
            tool_results.append(
                await self.tools.execute(
                    "get_product",
                    {"product_id": context.product_id},
                    auth_token=auth_token,
                    user_id=user_id,
                )
            )
            products = self.tools.extract_products(tool_results)
            name = context.product_name or (products[0].name if products else "ce produit")
            reply = await self.llm.generate(
                f"L'utilisateur regarde le produit « {name} » (id={context.product_id}). "
                f"Message : {message}\n"
                f"Donnees produit : {tool_results[0].result}\n"
                "Reponds en francais, utile et concis.",
                system=(
                    "Tu es l'assistant commerce L'AMI. "
                    "Base-toi sur les donnees produit fournies. Pas d'invention de prix."
                ),
            )
            detected = "commerce"
        elif detected == "support":
            reply, sources = await self._handle_support(message)
        elif detected == "commerce":
            reply, tool_results = await self._handle_commerce(
                message, conv_id, auth_token, user_id
            )
            products = self.tools.extract_products(tool_results)
        else:
            reply = await self._handle_general(message)

        cart_added = 0
        for tc in tool_results:
            if tc.name in ("add_to_cart", "add_build_to_cart") and isinstance(tc.result, dict):
                cart_added += int(tc.result.get("count") or 0)

        latency = int((time.perf_counter() - t0) * 1000)
        return ChatResponse(
            conversation_id=conv_id,
            reply=reply,
            mode=detected,
            sources=sources,
            tool_calls=tool_results,
            products=products,
            cart_added=cart_added,
            latency_ms=latency,
        )

    def detect_mode(self, message: str, forced: str = "auto") -> str:
        if forced in ("support", "commerce", "general"):
            return forced
        lower = message.lower()
        support_score = sum(1 for k in SUPPORT_KEYWORDS if k in lower)
        commerce_score = sum(1 for k in COMMERCE_KEYWORDS if k in lower)
        if support_score > commerce_score and support_score > 0:
            return "support"
        if commerce_score > 0:
            return "commerce"
        return "general"

    async def _handle_support(self, message: str) -> tuple[str, list[SourceDocument]]:
        rag = await get_rag_pipeline()
        sources = await rag.retrieve(message)
        context = rag.build_context(sources)
        prompt = rag.build_support_prompt(message, context)
        reply = await self.llm.generate(
            prompt,
            system=(
                "Tu es l'assistant technique L'AMI. "
                "Reponds en francais, 2 a 5 phrases maximum. "
                "Base-toi uniquement sur le contexte fourni. "
                "Si insuffisant, propose de creer un ticket support."
            ),
        )
        return reply, sources

    async def _handle_general(self, message: str) -> str:
        return await self.llm.generate(
            message,
            system=(
                "Tu es l'assistant L'AMI (Assistance & Maintenance Informatique, Madagascar). "
                "Tu aides pour le support technique, le catalogue et les configs PC en Ariary. "
                "Reponds en francais, poliment et brievement."
            ),
        )

    def _extract_budget(self, message: str) -> Optional[float]:
        lower = message.lower().replace(" ", "")
        # 2m / 2.5m / 2000000 / 2 000 000 Ar
        m = re.search(r"(\d+[.,]?\d*)\s*(m|millions?)", message.lower())
        if m:
            return float(m.group(1).replace(",", ".")) * 1_000_000
        m = re.search(r"(\d[\d\s]{2,})\s*(ar|ariary|mga)?", message.lower())
        if m:
            digits = re.sub(r"\D", "", m.group(1))
            if digits:
                val = float(digits)
                if val >= 10_000:
                    return val
        return None

    def _extract_usage(self, message: str) -> str:
        lower = message.lower()
        for u in ("gaming", "bureautique", "creation", "streaming", "montage"):
            if u in lower:
                return "creation" if u == "montage" else u
        return "bureautique"

    def _wants_cart_confirm(self, message: str) -> bool:
        lower = message.lower().strip()
        yes = ("oui", "ok", "d'accord", "daccord", "valide", "ajoute", "panier", "go", "yes")
        return any(w in lower for w in yes) and len(lower) < 80

    def _rejects_cart(self, message: str) -> bool:
        lower = message.lower()
        return any(w in lower for w in ("non", "annule", "pas maintenant", "refuse"))

    async def _handle_commerce(
        self,
        message: str,
        conv_id: str,
        auth_token: Optional[str],
        user_id: Optional[str],
    ) -> tuple[str, list[ToolCallResult]]:
        session = self.sessions.get(conv_id)
        tool_results: list[ToolCallResult] = []

        # Confirmation panier (EF-05 / EF-06)
        if session.get("pending_build") and self._wants_cart_confirm(message):
            build = session.get("pending_build") or []
            items = []
            for p in build:
                items.append({
                    "product_id": str(p.get("id") or p.get("product_id") or ""),
                    "name": p.get("name") or "",
                    "price": float(p.get("price") or 0),
                    "quantity": 1,
                    "image": (p.get("images") or [None])[0] if isinstance(p.get("images"), list) else p.get("image"),
                })
            tc = await self.tools.execute(
                "add_to_cart",
                {"items": items},
                auth_token=auth_token,
                user_id=user_id,
            )
            tool_results.append(tc)
            self.sessions.clear_key(conv_id, "pending_build")
            n = tc.result.get("count", 0) if isinstance(tc.result, dict) else 0
            reply = (
                f"C'est note : {n} article(s) pret(s) pour le panier. "
                "Ouvrez le panier pour finaliser la commande."
                if n
                else "Je n'ai pas pu preparer le panier. Reformulez votre configuration."
            )
            return reply, tool_results

        if session.get("pending_build") and self._rejects_cart(message):
            self.sessions.update(conv_id, last_reject=True)
            self.sessions.clear_key(conv_id, "pending_build")
            return (
                "D'accord, je n'ajoute rien. Donnez un autre budget ou usage si besoin.",
                [],
            )

        # Config PC budget-aware
        budget = self._extract_budget(message)
        lower = message.lower()
        wants_build = any(
            w in lower for w in ("pc", "config", "configuration", "montage", "build")
        ) or budget is not None

        if wants_build and budget:
            usage = self._extract_usage(message)
            tc = await self.tools.execute(
                "suggest_pc_build",
                {"usage": usage, "budget": budget},
                auth_token=auth_token,
                user_id=user_id,
            )
            tool_results.append(tc)
            data = tc.result if isinstance(tc.result, dict) else {}
            build = data.get("build") or []
            total = float(data.get("total") or 0)
            if build:
                self.sessions.update(conv_id, pending_build=build)
                lines = []
                for p in build:
                    price = float(p.get("price") or 0)
                    lines.append(f"- {p.get('name', '?')} : {price:,.0f} Ar".replace(",", " "))
                reply = (
                    f"Voici une suggestion {usage} sous {budget:,.0f} Ar "
                    f"(total estime {total:,.0f} Ar) :\n"
                    + "\n".join(lines)
                    + "\n\nRepondez « oui » pour preparer l'ajout au panier."
                ).replace(",", " ")
                return reply, tool_results
            return (
                "Je n'ai pas trouve assez de composants sous ce budget dans le catalogue. "
                "Essayez un budget plus eleve ou un usage different.",
                tool_results,
            )

        # Recherche produit simple
        category = None
        for key, cat in CATEGORY_MAP.items():
            if key in lower:
                category = cat
                break
        search = message
        for noise in ("je veux", "cherche", "montre", "des", "un", "une", "le", "la"):
            search = re.sub(rf"\b{noise}\b", " ", search, flags=re.I)
        search = " ".join(search.split())[:80] or message[:40]
        args: dict[str, Any] = {"search": search, "limit": 5}
        if category:
            args["category"] = category
        if budget:
            args["max_price"] = budget
        tc = await self.tools.execute("search_products", args, auth_token=auth_token)
        tool_results.append(tc)
        products = (tc.result or {}).get("products") if isinstance(tc.result, dict) else []
        if products:
            top = products[:3]
            lines = [
                f"- {p.get('name')} : {float(p.get('price') or 0):,.0f} Ar".replace(",", " ")
                for p in top
            ]
            reply = "Voici ce que je trouve dans le catalogue L'AMI :\n" + "\n".join(lines)
        else:
            reply = await self.llm.generate(
                f"Recherche catalogue vide pour : {message}. "
                "Propose une reformulation utile en francais (1-2 phrases).",
                system="Assistant commerce L'AMI, reponses courtes.",
            )
        return reply, tool_results


_orchestrator: Optional[AgentOrchestrator] = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
