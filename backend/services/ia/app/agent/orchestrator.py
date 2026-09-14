"""
Orchestrateur Agent : route la requete vers RAG (support) ou Tools (commerce).
Strategy Pattern + Chain of Responsibility simplifiee.
"""

import re
import time
from typing import Any, Optional
from uuid import uuid4

from app.agent.llm import get_llm_client
from app.agent.tools import get_tool_registry
from app.core.config import get_settings
from app.domain.models import ChatResponse, SourceDocument, ToolCallResult
from app.rag.pipeline import get_rag_pipeline


# Mots-cles pour le routage
SUPPORT_KEYWORDS = [
    "panne",
    "erreur",
    "ecran bleu",
    "bsod",
    "ne demarre",
    "surchauffe",
    "driver",
    "bios",
    "comment",
    "probleme",
    "bug",
    "diagnostic",
    "reparer",
    "installer",
    "pilote",
    "overheating",
    "pas de signal",
]

COMMERCE_KEYWORDS = [
    "acheter",
    "prix",
    "budget",
    "recommande",
    "configuration",
    "configurer",
    "pc pour",
    "carte graphique",
    "processeur",
    "meilleur",
    "combien",
    "disponible",
    "stock",
    "commander",
    "produit",
    "gaming",
    "montage video",
    "compar",
    "panier",
    "ariary",
    " millions",
    "ajoute",
    "composant",
]


# Memoire conversation (pending config PC)
_sessions: dict[str, dict[str, Any]] = {}


class AgentOrchestrator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.llm = get_llm_client()
        self.tools = get_tool_registry()

    def _session(self, conv_id: str) -> dict[str, Any]:
        if conv_id not in _sessions:
            _sessions[conv_id] = {}
        return _sessions[conv_id]

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

    def _extract_tool_intents(
        self, message: str, conv_id: str = ""
    ) -> list[tuple[str, dict[str, Any]]]:
        """Heuristique de function calling sans LLM structure (mode mock)."""
        lower = message.lower().strip()
        calls: list[tuple[str, dict]] = []
        session = self._session(conv_id) if conv_id else {}

        # Acceptation config -> ajouter au panier
        accept_words = (
            "oui", "ok", "d'accord", "daccord", "je suis d'accord",
            "ajoute", "ajouter", "panier", "vas-y", "valide", "validé",
            "je veux", "go", "confirme", "accepte", "yes",
        )
        reject_words = (
            "non", "pas maintenant", "plus tard", "refuse", "annule",
        )
        pending = session.get("pending_build")
        if pending and any(w in lower for w in accept_words):
            # Si le client parle encore de budget, ce n'est pas une simple acceptation
            if not re.search(r"\d{4,}", lower.replace(" ", "")):
                calls.append(("add_build_to_cart", {"build": pending}))
                return calls
        if pending and any(w in lower for w in reject_words) and len(lower) < 40:
            session.pop("pending_build", None)
            session["last_reject"] = True
            return calls  # pas d'outil — reponse texte

        # Budget Ar / EUR / millions
        budget_match = re.search(
            r"(\d[\d\s.,]*)\s*(ar|ariary|mga|€|euros?|eur)?",
            lower,
        )
        # aussi "3 millions" / "3.5 millions"
        millions = re.search(
            r"(\d+[.,]?\d*)\s*millions?",
            lower,
        )
        usage = None
        for u in ("gaming", "bureautique", "montage video", "montage", "creation"):
            if u in lower:
                usage = "montage video" if "montage" in u else u
                break

        budget = None
        if millions:
            budget = float(millions.group(1).replace(",", ".")) * 1_000_000
        elif budget_match:
            raw = budget_match.group(1).replace(" ", "").replace(",", ".")
            try:
                budget = float(raw)
            except ValueError:
                budget = None
            unit = (budget_match.group(2) or "").lower()
            if budget and unit in ("€", "euro", "euros", "eur"):
                budget = budget * 4500  # approx vers MGA

        wants_config = any(
            w in lower
            for w in (
                "config", "configuration", "configurer", "pc pour",
                "montage", "gaming", "bureautique", "assemble", "build",
            )
        )
        if budget and budget >= 100000 and (usage or wants_config or "pc" in lower):
            calls.append(
                (
                    "suggest_pc_build",
                    {"usage": usage or "gaming", "budget": budget},
                )
            )
            return calls
        if budget and budget >= 100000 and "budget" in lower:
            calls.append(
                (
                    "suggest_pc_build",
                    {"usage": usage or "gaming", "budget": budget},
                )
            )
            return calls

        if any(w in lower for w in ("categorie", "categories", "rayon")):
            calls.append(("list_categories", {}))

        if any(
            w in lower
            for w in (
                "cherche",
                "recherche",
                "trouve",
                "montre",
                "prix",
                "rtx",
                "ryzen",
                "intel",
                "nvidia",
                "ram",
                "ssd",
            )
        ):
            # Extraire une requete simple
            search = message
            for prefix in ("cherche", "recherche", "trouve-moi", "montre-moi", "je veux"):
                if prefix in lower:
                    idx = lower.find(prefix)
                    search = message[idx + len(prefix) :].strip(" :," )
                    break
            args: dict[str, Any] = {"search": search[:100], "limit": 5}
            price = re.search(r"(\d[\d\s]*)\s*(€|euros?)", lower)
            if price:
                args["max_price"] = float(price.group(1).replace(" ", ""))
            calls.append(("search_products", args))

        if any(w in lower for w in ("creer un ticket", "ouvrir un ticket", "ticket support")):
            calls.append(
                (
                    "create_support_ticket",
                    {
                        "title": message[:80],
                        "description": message,
                        "category": "materiel",
                        "priority": "medium",
                    },
                )
            )

        return calls

    async def handle(
        self,
        message: str,
        mode: str = "auto",
        conversation_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        start = time.perf_counter()
        conv_id = conversation_id or str(uuid4())
        detected = self.detect_mode(message, mode)
        # Si une config est en attente de confirmation, forcer mode commerce
        sess = self._session(conv_id)
        if sess.get("pending_build") and mode == "auto":
            lower = message.lower()
            if any(
                w in lower
                for w in (
                    "oui", "ok", "d'accord", "ajoute", "panier", "non",
                    "valide", "accepte", "vas-y", "confirme",
                )
            ):
                detected = "commerce"

        sources: list[SourceDocument] = []
        tool_results: list[ToolCallResult] = []
        reply = ""

        if detected == "support":
            reply, sources = await self._handle_support(message)
        elif detected == "commerce":
            reply, tool_results = await self._handle_commerce(
                message, conv_id=conv_id, auth_token=auth_token, user_id=user_id
            )
        else:
            # General : essayer tools puis fallback LLM
            intents = self._extract_tool_intents(message, conv_id)
            if not intents and self._session(conv_id).pop("last_reject", None):
                reply = (
                    "D'accord, rien n'a ete ajoute au panier. "
                    "Indiquez un autre budget ou usage pour une nouvelle configuration."
                )
            elif intents:
                reply, tool_results = await self._run_tools(
                    intents, message, conv_id=conv_id, auth_token=auth_token, user_id=user_id
                )
            else:
                reply = await self.llm.generate(
                    message,
                    system=(
                        "Tu es l'assistant conversationnel de L'AMI, "
                        "plateforme e-commerce et support technique PC. "
                        "Reponds en francais, de maniere professionnelle et concise. "
                        "Pour une config PC, demande usage et budget en Ariary."
                    ),
                )

        latency = int((time.perf_counter() - start) * 1000)
        return ChatResponse(
            conversation_id=conv_id,
            reply=reply,
            mode=detected,
            sources=sources,
            tool_calls=tool_results,
            latency_ms=latency,
        )

    async def _handle_support(
        self, message: str
    ) -> tuple[str, list[SourceDocument]]:
        rag = await get_rag_pipeline()
        sources = await rag.retrieve(message)
        context = rag.build_context(sources)
        prompt = rag.build_support_prompt(message, context)
        reply = await self.llm.generate(
            prompt,
            system=(
                "Assistant technique L'AMI. Reponses en francais, "
                "basees sur le contexte fourni uniquement."
            ),
        )
        return reply, sources

    async def _handle_commerce(
        self,
        message: str,
        conv_id: str = "",
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> tuple[str, list[ToolCallResult]]:
        intents = self._extract_tool_intents(message, conv_id)
        if not intents:
            session = self._session(conv_id)
            if session.pop("last_reject", None):
                return (
                    "D'accord, je ne touche pas au panier. "
                    "Donnez un autre budget ou usage pour une nouvelle config.",
                    [],
                )
            intents = [("search_products", {"search": message[:80], "limit": 5})]
        return await self._run_tools(
            intents, message, conv_id=conv_id, auth_token=auth_token, user_id=user_id
        )

    async def _run_tools(
        self,
        intents: list[tuple[str, dict]],
        original_message: str,
        conv_id: str = "",
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> tuple[str, list[ToolCallResult]]:
        results: list[ToolCallResult] = []
        summaries: list[str] = []
        session = self._session(conv_id) if conv_id else {}

        for name, args in intents:
            # Outil virtuel: ajouter la derniere config au panier
            if name == "add_build_to_cart":
                build = args.get("build") or session.get("pending_build") or {}
                comps = build.get("components") or build.get("suggested_components") or []
                cart_items = []
                for c in comps:
                    if not c.get("id"):
                        continue
                    cart_items.append({
                        "product_id": c.get("id"),
                        "name": c.get("name"),
                        "price": c.get("price") or 0,
                        "quantity": 1,
                        "image": c.get("image") or "",
                        "slot": c.get("slot") or "",
                    })
                raw = {
                    "action": "add_to_cart",
                    "items": cart_items,
                    "count": len(cart_items),
                    "total": sum(i["price"] for i in cart_items),
                    "message": "Configuration ajoutee au panier",
                }
                session.pop("pending_build", None)
                results.append(ToolCallResult(name="add_to_cart", arguments=args, result=raw))
                summaries.append(self._summarize_tool("add_to_cart", raw))
                continue

            raw = await self.tools.execute(
                name, args, auth_token=auth_token, user_id=user_id
            )
            # Memoriser la config proposee pour confirmation client
            if name == "suggest_pc_build" and isinstance(raw, dict) and not raw.get("error"):
                session["pending_build"] = raw
            results.append(
                ToolCallResult(name=name, arguments=args, result=raw)
            )
            summaries.append(self._summarize_tool(name, raw))

        # Config / panier : reponse structuree (ne pas laisser le LLM effacer la question)
        if any(n in ("suggest_pc_build", "add_build_to_cart", "add_to_cart") for n, _ in intents) or any(
            r.name == "add_to_cart" for r in results
        ):
            reply = "\n\n".join(summaries)
            return reply, results

        tools_context = "\n".join(summaries)
        prompt = (
            f"Message client : {original_message}\n\n"
            f"Resultats des outils :\n{tools_context}\n\n"
            "Redige une reponse claire et utile en francais pour le client, "
            "en te basant sur ces resultats. Ne mentionne pas les outils techniques. "
            "Prix en Ariary (Ar)."
        )
        reply = await self.llm.generate(prompt)
        return reply, results

    def _summarize_tool(self, name: str, raw: Any) -> str:
        if not isinstance(raw, dict):
            return f"{name}: {raw}"

        if raw.get("error"):
            return f"{name}: erreur - {raw['error']}"

        if name == "search_products":
            products = raw.get("products", [])
            if not products:
                return "search_products: aucun produit trouve"
            lines = [
                f"- {p.get('name')} ({p.get('brand')}) : {p.get('price')} Ar, stock {p.get('stock')}"
                for p in products
            ]
            return "Produits trouves:\n" + "\n".join(lines)

        if name == "suggest_pc_build":
            comps = raw.get("suggested_components") or raw.get("components") or []
            lines = []
            for c in comps:
                slot = c.get("slot") or ""
                nm = c.get("name") or "?"
                pr = c.get("price") or 0
                prefix = f"[{slot}] " if slot else ""
                lines.append(f"- {prefix}{nm} : {pr:,.0f} Ar".replace(",", " "))
            total = raw.get("estimated_total", 0)
            budget = raw.get("budget", 0)
            return (
                f"Voici une configuration {raw.get('usage')} pour un budget de {budget:,.0f} Ar :\n".replace(",", " ")
                + "\n".join(lines)
                + f"\n\nTotal estime : {total:,.0f} Ar.".replace(",", " ")
                + "\n\nSouhaitez-vous que j'ajoute ces composants dans votre panier ?"
            )

        if name == "add_to_cart":
            n = raw.get("count", 0)
            total = raw.get("total", 0)
            return (
                f"Parfait — j'ai ajoute {n} composant(s) dans votre panier "
                f"(total approx. {total:,.0f} Ar). ".replace(",", " ")
                + "Ouvrez le panier pour finaliser la commande."
            )

        if name == "create_support_ticket":
            return (
                f"Ticket cree: {raw.get('ticket_number')} "
                f"(statut {raw.get('status')})"
            )

        if name == "list_categories":
            cats = raw.get("categories", [])
            names = [c.get("name") for c in cats]
            return "Categories: " + ", ".join(names)

        return f"{name}: {raw}"


_orchestrator: Optional[AgentOrchestrator] = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgentOrchestrator()
    return _orchestrator
