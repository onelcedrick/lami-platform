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
from app.domain.models import (
    ChatResponse,
    ProductCard,
    SourceDocument,
    ToolCallResult,
)
from app.rag.pipeline import get_rag_pipeline


# Mots-cles pour le routage
SUPPORT_KEYWORDS = [
    "panne", "erreur", "ecran bleu", "bsod", "ne demarre", "surchauffe",
    "driver", "bios", "comment", "probleme", "bug", "diagnostic",
    "reparer", "installer", "pilote", "overheating", "pas de signal",
]

COMMERCE_KEYWORDS = [
    "acheter", "prix", "budget", "recommande", "configuration", "configurer",
    "pc pour", "carte graphique", "processeur", "meilleur", "combien",
    "disponible", "stock", "commander", "produit", "gaming", "montage video",
    "compar", "panier", "ariary", " millions", "ajoute", "composant",
]

# ✅ Mapping mot-clé → catégorie pour la recherche
CATEGORY_MAP = {
    "cpu": "CPU",
    "processeur": "CPU",
    "gpu": "GPU",
    "carte graphique": "GPU",
    "ram": "RAM",
    "memoire": "RAM",
    "ssd": "Stockage",
    "nvme": "Stockage",
    "hdd": "Stockage",
    "disque dur": "Stockage",
    "stockage": "Stockage",
    "alimentation": "Alimentation",
    "psu": "Alimentation",
    "carte mere": "Carte mere",
    "motherboard": "Carte mere",
    "boitier": "Boitier",
    "ventirad": "Refroidissement",
    "ventilateur": "Refroidissement",
}


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
        reject_words = ("non", "pas maintenant", "plus tard", "refuse", "annule")

        pending = session.get("pending_build")
        if pending and any(w in lower for w in accept_words):
            if not re.search(r"\d{4,}", lower.replace(" ", "")):
                calls.append(("add_build_to_cart", {"build": pending}))
                return calls
        if pending and any(w in lower for w in reject_words) and len(lower) < 40:
            session.pop("pending_build", None)
            session["last_reject"] = True
            return calls

        # Budget Ar / EUR / millions
        budget_match = re.search(
            r"(\d[\d\s.,]*)\s*(ar|ariary|mga|€|euros?|eur)?", lower,
        )
        millions = re.search(r"(\d+[.,]?\d*)\s*millions?", lower)
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
                budget = budget * 4500

        # ✅ Détection améliorée des configs (ajout de "setup", "monter", "monte")
        wants_config = any(
            w in lower
            for w in (
                "config", "configuration", "configurer", "pc pour",
                "montage", "gaming", "bureautique", "assemble", "build",
                "setup", "monter", "monte",
            )
        )

        # ✅ Détecter "setup" / "monter" avec budget
        if budget and budget >= 100000:
            if wants_config or usage or "pc" in lower or "setup" in lower or "monter" in lower:
                calls.append((
                    "suggest_pc_build",
                    {"usage": usage or "gaming", "budget": budget},
                ))
                return calls
            # Budget seul
            if "budget" in lower:
                calls.append((
                    "suggest_pc_build",
                    {"usage": usage or "gaming", "budget": budget},
                ))
                return calls

        if any(w in lower for w in ("categorie", "categories", "rayon")):
            calls.append(("list_categories", {}))

        # ✅ Détection de catégorie (CPU, GPU, RAM, SSD, etc.)
        for keyword, category in CATEGORY_MAP.items():
            if keyword in lower:
                calls.append((
                    "search_products",
                    {"category": category, "limit": 10},
                ))
                return calls

        # ✅ "autre produit", "similaire", "comme ça"
        if any(w in lower for w in ("similaire", "comme ça", "autre produit", "autre option")):
            last_cat = session.get("last_category")
            if last_cat:
                calls.append((
                    "search_products",
                    {"category": last_cat, "limit": 5},
                ))
                return calls

        if any(
            w in lower
            for w in (
                "cherche", "recherche", "trouve", "montre", "prix",
                "rtx", "ryzen", "intel", "nvidia",
            )
        ):
            search = message
            for prefix in ("cherche", "recherche", "trouve-moi", "montre-moi", "je veux"):
                if prefix in lower:
                    idx = lower.find(prefix)
                    search = message[idx + len(prefix):].strip(" :,")
                    break
            args: dict[str, Any] = {"search": search[:100], "limit": 5}
            price = re.search(r"(\d[\d\s]*)\s*(€|euros?)", lower)
            if price:
                args["max_price"] = float(price.group(1).replace(" ", ""))
            calls.append(("search_products", args))

        if any(w in lower for w in ("creer un ticket", "ouvrir un ticket", "ticket support")):
            calls.append((
                "create_support_ticket",
                {
                    "title": message[:80],
                    "description": message,
                    "category": "materiel",
                    "priority": "medium",
                },
            ))

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
                        "Tu es l'assistant L'AMI, plateforme e-commerce PC a Madagascar. "
                        "REGLES STRICTES :\n"
                        "1. Reponds en 2 phrases MAXIMUM. Pas de tableau, pas de liste longue.\n"
                        "2. Si le client cherche un produit ou un PC, propose des produits "
                        "du catalogue (pas de conseils generiques).\n"
                        "3. Ton direct et utile. Pas de 'Bonjour', pas de 'Je comprends'.\n"
                        "4. Prix en Ariary (Ar), format court : 2 300 000 Ar.\n"
                        "5. Si tu ne sais pas, propose de chercher dans le catalogue."
                    ),
                )

        # ✅ Extraire les produits des tool_calls pour le frontend (avec fallback)
        products_for_ui: list[ProductCard] = []
        try:
            for tr in tool_results:
                if tr.name == "search_products" and isinstance(tr.result, dict):
                    for p in tr.result.get("products", [])[:3]:
                        try:
                            products_for_ui.append(
                                ProductCard(
                                    id=str(p.get("id") or ""),
                                    name=str(p.get("name") or ""),
                                    brand=str(p.get("brand") or ""),
                                    price=float(p.get("price") or 0),
                                    stock=int(p.get("stock") or 0),
                                    image=p.get("image") if p.get("image") else None,
                                    slug=p.get("slug") if p.get("slug") else None,
                                    rating=float(p["rating"]) if p.get("rating") else None,
                                )
                            )
                        except Exception as e:
                            print(f"[orchestrator] skip product: {e}")
                            continue
                if tr.name == "add_to_cart" and isinstance(tr.result, dict):
                    for it in tr.result.get("items", []):
                        try:
                            products_for_ui.append(
                                ProductCard(
                                    id=str(it.get("product_id") or ""),
                                    name=str(it.get("name") or ""),
                                    brand="",
                                    price=float(it.get("price") or 0),
                                    stock=0,
                                    image=it.get("image") if it.get("image") else None,
                                    slug=None,
                                    rating=None,
                                )
                            )
                        except Exception as e:
                            print(f"[orchestrator] skip cart item: {e}")
                            continue
        except Exception as e:
            print(f"[orchestrator] products_for_ui error: {e}")
            products_for_ui = []

        latency = int((time.perf_counter() - start) * 1000)
        return ChatResponse(
            conversation_id=conv_id,
            reply=reply,
            mode=detected,
            sources=sources,
            tool_calls=tool_results,
            products=products_for_ui,
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
                "Tu es l'assistant technique L'AMI. "
                "Reponds en 2 phrases maximum, en francais. "
                "Base-toi uniquement sur le contexte fourni. "
                "Pas de tableau, pas de liste longue. "
                "Si tu ne sais pas, propose de creer un ticket support."
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

            # ✅ Extraire un terme court (pas toute la phrase)
            lower = message.lower()
            search_term = ""

            # Priorité : usage détecté
            for u in ("gaming", "bureautique", "creation", "streaming", "montage"):
                if u in lower:
                    search_term = u
                    break

            # Sinon : 2 premiers mots significatifs
            if not search_term:
                words = [
                    w for w in re.split(r"[\s,.;:!?]+", message)
                    if len(w) > 2 and w.lower() not in (
                        "pour", "avec", "dans", "les", "des", "une", "un",
                    )
                ]
                search_term = " ".join(words[:2]) if words else message[:30]

            intents = [("search_products", {"search": search_term, "limit": 5})]

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
            if name == "suggest_pc_build" and isinstance(raw, dict) and not raw.get("error"):
                session["pending_build"] = raw

            # ✅ Mémoriser la catégorie pour "autre produit similaire"
            if name == "search_products" and isinstance(raw, dict):
                args_cat = args.get("category")
                if args_cat:
                    session["last_category"] = args_cat

            results.append(ToolCallResult(name=name, arguments=args, result=raw))
            summaries.append(self._summarize_tool(name, raw))

        # ✅ search_products : toujours répondre SANS le LLM (pour garder les vrais prix)
        if any(n == "search_products" for n, _ in intents):
            reply = "\n\n".join(summaries)
            return reply, results

        # Config / panier : réponse structurée
        if any(n in ("suggest_pc_build", "add_build_to_cart", "add_to_cart") for n, _ in intents) or any(
            r.name == "add_to_cart" for r in results
        ):
            reply = "\n\n".join(summaries)
            return reply, results

        # Fallback LLM (cas général seulement)
        tools_context = "\n".join(summaries)
        prompt = (
            f"Message client : {original_message}\n\n"
            f"Resultats :\n{tools_context}\n\n"
            "Redige une reponse TRES COURTE (2 phrases max) en francais. "
            "Pas de 'Bonjour', pas de 'Je comprends', pas de tableau. "
            "Prix en Ariary. Si des produits sont trouves, cite-les brievement. "
            "Si aucun produit, propose de chercher autre chose."
        )
        reply = await self.llm.generate(prompt)
        return reply, results

    def _summarize_tool(self, name: str, raw: Any) -> str:
        if not isinstance(raw, dict):
            return f"{name}: {raw}"

        if raw.get("error"):
            return f"{name}: erreur - {raw['error']}"

        # ✅ Affichage structuré avec vrais prix + stock
        if name == "search_products":
            products = raw.get("products", [])
            if not products:
                return "Aucun produit trouve dans le catalogue. Essayez un autre terme."
            count = len(products)

            lines = []
            for p in products[:5]:
                name_p = p.get("name", "?")
                brand = p.get("brand", "")
                price = p.get("price") or 0
                stock = p.get("stock") or 0

                line = f"- {name_p}"
                if brand:
                    line += f" ({brand})"
                line += f" : {price:,.0f} Ar".replace(",", " ")
                if stock > 0:
                    line += f", {stock} en stock"
                lines.append(line)

            suffix = ""
            if count > 5:
                rest = count - 5
                rest_plural = "s" if rest > 1 else ""
                suffix = f"\n\n(+{rest} autre{rest_plural} produit{rest_plural})"

            header = f"J'ai trouve {count} produit{'s' if count > 1 else ''} :"
            return header + "\n" + "\n".join(lines) + suffix

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
                f"Voici une configuration {raw.get('usage')} pour un budget de "
                f"{budget:,.0f} Ar :\n".replace(",", " ")
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