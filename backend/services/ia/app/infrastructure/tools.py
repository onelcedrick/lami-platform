"""
Registre d'outils (Function Calling) — Pattern Registry + Adapter.

La lecture du catalogue passe par CatalogCache (recherche / categorie /
budget / tri cote Python). Seule la creation de ticket reste un appel HTTP
direct vers le microservice Go.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Optional

import httpx

from app.core.config import get_settings
from app.domain.models import ProductCard, ToolCallResult
from app.domain.ports import ToolPort
from app.infrastructure.catalog_cache import (
    _price,
    _rating,
    _stock,
    get_catalog_cache,
    resolve_categories,
)

logger = logging.getLogger("ia.tools")

# Profils de configuration : poids normalises a 1.0, carte mere incluse.
BUILD_PROFILES: dict[str, dict[str, float]] = {
    "gaming": {
        "GPU": 0.32, "CPU": 0.20, "Carte mere": 0.12, "RAM": 0.10,
        "Stockage": 0.09, "Alimentation": 0.09, "Boitier": 0.08,
    },
    "bureautique": {
        "CPU": 0.28, "Carte mere": 0.18, "Stockage": 0.16,
        "RAM": 0.14, "Alimentation": 0.13, "Boitier": 0.11,
    },
    "creation": {
        "GPU": 0.26, "CPU": 0.24, "RAM": 0.14, "Stockage": 0.12,
        "Carte mere": 0.12, "Alimentation": 0.08, "Boitier": 0.04,
    },
    "streaming": {
        "CPU": 0.26, "GPU": 0.24, "RAM": 0.12, "Carte mere": 0.12,
        "Stockage": 0.11, "Alimentation": 0.09, "Boitier": 0.06,
    },
}


class ToolDefinition:
    def __init__(self, name: str, description: str,
                 parameters: dict[str, Any], handler: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler

    def schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


def _first_image(p: dict) -> Optional[str]:
    imgs = p.get("images")
    if isinstance(imgs, list) and imgs:
        v = imgs[0]
        if isinstance(v, str) and v:
            return v
    if isinstance(imgs, str) and imgs:
        return imgs
    v = p.get("image")
    return v if isinstance(v, str) and v else None


class ToolRegistry(ToolPort):
    def __init__(self) -> None:
        self.settings = get_settings()
        self._tools: dict[str, ToolDefinition] = {}
        self._register_defaults()

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def list_schemas(self) -> list[dict[str, Any]]:
        return [t.schema() for t in self._tools.values()]

    def _register_defaults(self) -> None:
        self.register(ToolDefinition(
            name="search_products",
            description="Recherche des produits du catalogue L'AMI (categorie, budget Ariary).",
            parameters={
                "type": "object",
                "properties": {
                    "search": {"type": "string"},
                    "category": {"type": "string"},
                    "max_price": {"type": "number"},
                    "limit": {"type": "integer"},
                },
            },
            handler=self._search_products,
        ))
        self.register(ToolDefinition(
            name="get_product",
            description="Detail d'un produit par ID ou slug.",
            parameters={"type": "object", "properties": {
                "product_id": {"type": "string"}, "slug": {"type": "string"}}},
            handler=self._get_product,
        ))
        self.register(ToolDefinition(
            name="suggest_pc_build",
            description="Configuration PC compatible selon usage et budget en Ariary.",
            parameters={
                "type": "object",
                "properties": {
                    "usage": {"type": "string",
                              "description": "gaming | bureautique | creation | streaming"},
                    "budget": {"type": "number"},
                },
                "required": ["usage", "budget"],
            },
            handler=self._suggest_pc_build,
        ))
        self.register(ToolDefinition(
            name="create_support_ticket",
            description="Cree un ticket support pour l'utilisateur authentifie.",
            parameters={
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string",
                                 "enum": ["low", "medium", "high", "urgent"]},
                },
                "required": ["title", "description"],
            },
            handler=self._create_support_ticket,
        ))
        self.register(ToolDefinition(
            name="list_categories",
            description="Liste les categories du catalogue L'AMI.",
            parameters={"type": "object", "properties": {}},
            handler=self._list_categories,
        ))
        self.register(ToolDefinition(
            name="add_to_cart",
            description="Prepare l'ajout au panier apres confirmation utilisateur.",
            parameters={
                "type": "object",
                "properties": {"items": {"type": "array", "items": {"type": "object"}}},
                "required": ["items"],
            },
            handler=self._add_to_cart,
        ))

    async def execute(self, name: str, arguments: dict[str, Any],
                      auth_token: Optional[str] = None,
                      user_id: Optional[str] = None) -> ToolCallResult:
        tool = self._tools.get(name)
        if not tool:
            return ToolCallResult(name=name, arguments=arguments,
                                  result={"error": f"Outil inconnu: {name}"})
        try:
            result = await tool.handler(arguments, auth_token=auth_token, user_id=user_id)
            return ToolCallResult(name=name, arguments=arguments, result=result)
        except Exception as exc:
            logger.warning("Outil %s en erreur : %s", name, exc)
            return ToolCallResult(name=name, arguments=arguments,
                                  result={"error": f"{type(exc).__name__}: {exc}"})

    def extract_products(self, tool_results: list[ToolCallResult]) -> list[ProductCard]:
        cards: list[ProductCard] = []
        seen: set[str] = set()
        for tc in tool_results:
            data = tc.result
            if not isinstance(data, dict) or data.get("error"):
                continue
            items: list[Any] = []
            if isinstance(data.get("build"), list):
                items = data["build"]
            elif isinstance(data.get("product"), dict):
                items = [data["product"]]
            else:
                items = data.get("products") or data.get("items") or []
            if not isinstance(items, list):
                continue
            for p in items:
                if not isinstance(p, dict):
                    continue
                pid = str(p.get("id") or p.get("product_id") or "")
                if not pid or pid in seen:
                    continue
                seen.add(pid)
                try:
                    rating = float(p.get("rating")) if p.get("rating") is not None else None
                except (TypeError, ValueError):
                    rating = None
                cards.append(ProductCard(
                    id=pid,
                    name=str(p.get("name") or ""),
                    brand=str(p.get("brand") or ""),
                    price=_price(p),
                    stock=_stock(p),
                    image=_first_image(p),
                    slug=p.get("slug") if isinstance(p.get("slug"), str) else None,
                    rating=rating,
                ))
        return cards

    # ---- HTTP (tickets uniquement) ----
    def _headers(self, auth_token: Optional[str] = None) -> dict[str, str]:
        h = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth_token:
            h["Authorization"] = f"Bearer {auth_token}"
        return h

    # ---- Handlers ----
    async def _search_products(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        cache = await get_catalog_cache()
        max_p = args.get("max_price")
        try:
            max_p = float(max_p) if max_p is not None else None
        except (TypeError, ValueError):
            max_p = None
        products = await cache.search(
            query=str(args.get("search") or ""),
            category=args.get("category"),
            max_price=max_p,
            limit=int(args.get("limit") or 5),
        )
        return {"products": products, "count": len(products)}

    async def _get_product(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        pid = str(args.get("product_id") or "")
        slug = str(args.get("slug") or "")
        if not pid and not slug:
            return {"error": "product_id ou slug requis"}
        cache = await get_catalog_cache()
        p = cache.find(product_id=pid, slug=slug)
        if p is None:
            return {"error": "Produit introuvable"}
        return {"product": {k: v for k, v in p.items() if not k.startswith("_")}}

    async def _suggest_pc_build(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        """Configurateur PC : delegation au moteur de compatibilite materielle."""
        from app.infrastructure.pc_compat import assemble_build

        usage = str(args.get("usage") or "bureautique").lower()
        if usage in ("montage", "montage video", "video"):
            usage = "creation"
        try:
            budget = float(args.get("budget") or 0)
        except (TypeError, ValueError):
            budget = 0.0
        if budget <= 0:
            return {"error": "budget invalide", "build": [], "total": 0,
                    "estimated_total": 0, "count": 0, "slots_filled": 0}

        cache = await get_catalog_cache()
        return assemble_build(cache, usage, budget)

    async def _create_support_ticket(self, args: dict, auth_token: Optional[str] = None,
                                     user_id: Optional[str] = None, **_) -> dict:
        if not auth_token:
            return {"error": "Authentification requise pour creer un ticket"}
        body = {
            "title": args.get("title") or "Demande support",
            "description": args.get("description") or "",
            "priority": args.get("priority") or "medium",
            "category": "technical",
        }
        url = f"{self.settings.ticket_url.rstrip('/')}/api/v1/tickets"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=body, headers=self._headers(auth_token))
        except Exception as exc:
            return {"error": f"Service ticket injoignable ({type(exc).__name__})"}

        if res.status_code >= 400:
            return {"error": f"HTTP {res.status_code}", "detail": res.text[:200]}
        try:
            payload = res.json()
        except Exception:
            return {"error": "Reponse ticket illisible"}

        data = payload.get("data", payload) if isinstance(payload, dict) else payload
        if isinstance(data, dict) and data.get("error"):
            return {"error": str(data["error"])}
        if not isinstance(data, dict) or not (data.get("id") or data.get("_id")):
            return {"error": "Ticket non cree (reponse inattendue)"}
        return {"ticket": data}

    async def _list_categories(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        cache = await get_catalog_cache()
        cats = cache.categories()
        return {"categories": cats, "count": len(cats)}

    async def _add_to_cart(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        """Prepare l'ajout au panier (le panier reel vit cote frontend/Zustand).

        IMPORTANT : on conserve stock / brand / slug / image dans les items,
        sinon les cartes produit affichees apres confirmation indiquent
        a tort "Rupture" (stock absent => 0).
        """
        items = args.get("items") or []
        if not isinstance(items, list) or not items:
            return {"error": "Aucun article", "count": 0, "items": []}
        normalized = []
        for it in items:
            if not isinstance(it, dict):
                continue
            normalized.append({
                "product_id": str(it.get("product_id") or it.get("id") or ""),
                "name": str(it.get("name") or ""),
                "price": _price(it),
                "quantity": int(it.get("quantity") or 1),
                "image": _first_image(it) or "",
                "stock": int(float(it.get("stock"))) if it.get("stock") is not None else 0,
                "brand": str(it.get("brand") or ""),
                "slug": it.get("slug") if isinstance(it.get("slug"), str) else None,
            })
        return {"items": normalized, "count": len(normalized), "ok": True}

_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry
