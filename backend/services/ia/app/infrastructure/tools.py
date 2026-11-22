"""
Registre d'outils (Function Calling) — appels HTTP vers microservices Go.
Pattern Registry + Adapter.
"""

from __future__ import annotations

from typing import Any, Callable, Optional
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.domain.models import ProductCard, ToolCallResult
from app.domain.ports import ToolPort


class ToolDefinition:
    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        handler: Callable,
    ):
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
        self.register(
            ToolDefinition(
                name="search_products",
                description=(
                    "Recherche des produits dans le catalogue L'AMI "
                    "(CPU, GPU, RAM, PC, etc.). Filtre optionnel par budget Ariary."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "search": {"type": "string", "description": "Texte de recherche"},
                        "category": {"type": "string", "description": "Categorie optionnelle"},
                        "max_price": {"type": "number", "description": "Budget max en Ariary"},
                        "limit": {"type": "integer", "description": "Nombre max (defaut 5)"},
                    },
                },
                handler=self._search_products,
            )
        )
        self.register(
            ToolDefinition(
                name="get_product",
                description="Detail d'un produit par ID ou slug.",
                parameters={
                    "type": "object",
                    "properties": {
                        "product_id": {"type": "string"},
                        "slug": {"type": "string"},
                    },
                },
                handler=self._get_product,
            )
        )
        self.register(
            ToolDefinition(
                name="suggest_pc_build",
                description=(
                    "Propose une configuration PC compatible selon usage et budget en Ariary."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "usage": {
                            "type": "string",
                            "description": "gaming | bureautique | creation | streaming",
                        },
                        "budget": {
                            "type": "number",
                            "description": "Budget maximum en Ariary (MGA)",
                        },
                    },
                    "required": ["usage", "budget"],
                },
                handler=self._suggest_pc_build,
            )
        )
        self.register(
            ToolDefinition(
                name="create_support_ticket",
                description="Cree un ticket support technique pour l'utilisateur authentifie.",
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {
                            "type": "string",
                            "enum": ["low", "medium", "high", "urgent"],
                        },
                    },
                    "required": ["title", "description"],
                },
                handler=self._create_support_ticket,
            )
        )
        self.register(
            ToolDefinition(
                name="list_categories",
                description="Liste les categories du catalogue L'AMI.",
                parameters={"type": "object", "properties": {}},
                handler=self._list_categories,
            )
        )
        self.register(
            ToolDefinition(
                name="add_to_cart",
                description=(
                    "Ajoute des produits au panier (apres confirmation utilisateur). "
                    "Retourne cart_items pour le frontend."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "product_id": {"type": "string"},
                                    "name": {"type": "string"},
                                    "price": {"type": "number"},
                                    "quantity": {"type": "integer"},
                                    "image": {"type": "string"},
                                },
                            },
                        },
                    },
                    "required": ["items"],
                },
                handler=self._add_to_cart,
            )
        )

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any],
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ToolCallResult:
        tool = self._tools.get(name)
        if not tool:
            return ToolCallResult(
                name=name,
                arguments=arguments,
                result={"error": f"Outil inconnu: {name}"},
            )
        try:
            result = await tool.handler(
                arguments,
                auth_token=auth_token,
                user_id=user_id,
            )
            return ToolCallResult(name=name, arguments=arguments, result=result)
        except Exception as exc:
            return ToolCallResult(
                name=name,
                arguments=arguments,
                result={"error": str(exc)},
            )

    def extract_products(self, tool_results: list[ToolCallResult]) -> list[ProductCard]:
        cards: list[ProductCard] = []
        seen: set[str] = set()
        for tc in tool_results:
            data = tc.result
            if not isinstance(data, dict) or data.get("error"):
                continue
            items = data.get("products") or data.get("items") or []
            if isinstance(data.get("product"), dict):
                items = [data["product"]]
            if data.get("build") and isinstance(data["build"], list):
                items = data["build"]
            for p in items:
                if not isinstance(p, dict):
                    continue
                pid = str(p.get("id") or p.get("product_id") or "")
                if not pid or pid in seen:
                    continue
                seen.add(pid)
                cards.append(
                    ProductCard(
                        id=pid,
                        name=str(p.get("name") or ""),
                        brand=str(p.get("brand") or ""),
                        price=float(p.get("price") or 0),
                        stock=int(p.get("stock") or 0),
                        image=p.get("image") or (p.get("images") or [None])[0],
                        slug=p.get("slug"),
                        rating=p.get("rating"),
                    )
                )
        return cards

    # ---- HTTP helpers ----

    def _headers(self, auth_token: Optional[str] = None) -> dict[str, str]:
        h = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth_token:
            h["Authorization"] = f"Bearer {auth_token}"
        return h

    async def _get_json(self, url: str, params: Optional[dict] = None, auth_token: Optional[str] = None) -> Any:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(url, params=params or {}, headers=self._headers(auth_token))
            if res.status_code >= 400:
                return {"error": f"HTTP {res.status_code}", "detail": res.text[:300]}
            return res.json()

    async def _post_json(self, url: str, body: dict, auth_token: Optional[str] = None) -> Any:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=body, headers=self._headers(auth_token))
            if res.status_code >= 400:
                return {"error": f"HTTP {res.status_code}", "detail": res.text[:300]}
            return res.json()

    def _unwrap(self, payload: Any) -> Any:
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    # ---- Handlers ----

    async def _search_products(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        params: dict[str, Any] = {"limit": int(args.get("limit") or 5)}
        if args.get("search"):
            params["search"] = args["search"]
        if args.get("category"):
            params["category"] = args["category"]
        if args.get("max_price") is not None:
            params["max_price"] = args["max_price"]
        raw = await self._get_json(
            f"{self.settings.catalog_url}/api/v1/catalog/products",
            params=params,
            auth_token=auth_token,
        )
        data = self._unwrap(raw)
        products = data if isinstance(data, list) else (data.get("items") if isinstance(data, dict) else [])
        # Filtre budget local de securite
        max_p = args.get("max_price")
        if max_p is not None and products:
            products = [p for p in products if float(p.get("price") or 0) <= float(max_p)]
        return {"products": products or [], "count": len(products or [])}

    async def _get_product(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        pid = args.get("product_id")
        slug = args.get("slug")
        if pid:
            raw = await self._get_json(
                f"{self.settings.catalog_url}/api/v1/catalog/products/{pid}",
                auth_token=auth_token,
            )
        elif slug:
            raw = await self._get_json(
                f"{self.settings.catalog_url}/api/v1/catalog/products/slug/{slug}",
                auth_token=auth_token,
            )
        else:
            return {"error": "product_id ou slug requis"}
        data = self._unwrap(raw)
        return {"product": data}

    async def _suggest_pc_build(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        usage = str(args.get("usage") or "bureautique").lower()
        budget = float(args.get("budget") or 0)
        if budget <= 0:
            return {"error": "budget invalide"}
        # Categories cibles selon usage
        targets = {
            "gaming": ["CPU", "GPU", "RAM", "Stockage", "Alimentation", "Boitier"],
            "bureautique": ["CPU", "RAM", "Stockage", "Alimentation"],
            "creation": ["CPU", "GPU", "RAM", "Stockage", "Alimentation"],
            "streaming": ["CPU", "GPU", "RAM", "Stockage", "Alimentation"],
        }
        cats = targets.get(usage, targets["bureautique"])
        # Allocation budget simple
        weights = {
            "CPU": 0.25, "GPU": 0.35, "RAM": 0.12, "Stockage": 0.12,
            "Alimentation": 0.10, "Boitier": 0.06,
        }
        build = []
        total = 0.0
        for cat in cats:
            share = weights.get(cat, 0.1)
            max_price = budget * share * 1.15
            raw = await self._get_json(
                f"{self.settings.catalog_url}/api/v1/catalog/products",
                params={"category": cat, "max_price": max_price, "limit": 3, "sort_by": "price"},
                auth_token=auth_token,
            )
            data = self._unwrap(raw)
            products = data if isinstance(data, list) else (data.get("items") if isinstance(data, dict) else [])
            if not products:
                # fallback search by name
                raw2 = await self._get_json(
                    f"{self.settings.catalog_url}/api/v1/catalog/products",
                    params={"search": cat, "limit": 3},
                    auth_token=auth_token,
                )
                data2 = self._unwrap(raw2)
                products = data2 if isinstance(data2, list) else (data2.get("items") if isinstance(data2, dict) else [])
            if products:
                # prend le meilleur sous budget restant
                remaining = budget - total
                candidates = [p for p in products if float(p.get("price") or 0) <= remaining]
                pick = candidates[-1] if candidates else None
                if pick is None and products and float(products[0].get("price") or 0) <= remaining:
                    pick = products[0]
                if pick:
                    build.append(pick)
                    total += float(pick.get("price") or 0)
        return {
            "usage": usage,
            "budget": budget,
            "total": total,
            "within_budget": total <= budget,
            "build": build,
            "count": len(build),
        }

    async def _create_support_ticket(
        self, args: dict, auth_token: Optional[str] = None, user_id: Optional[str] = None, **_
    ) -> dict:
        if not auth_token:
            return {"error": "Authentification requise pour creer un ticket"}
        body = {
            "title": args.get("title") or "Demande support",
            "description": args.get("description") or "",
            "priority": args.get("priority") or "medium",
            "category": "technical",
        }
        raw = await self._post_json(
            f"{self.settings.ticket_url}/api/v1/tickets",
            body=body,
            auth_token=auth_token,
        )
        data = self._unwrap(raw)
        return {"ticket": data}

    async def _list_categories(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        raw = await self._get_json(
            f"{self.settings.catalog_url}/api/v1/catalog/categories",
            auth_token=auth_token,
        )
        data = self._unwrap(raw)
        return {"categories": data if isinstance(data, list) else []}

    async def _add_to_cart(self, args: dict, auth_token: Optional[str] = None, **_) -> dict:
        items = args.get("items") or []
        if not items:
            return {"error": "Aucun article", "count": 0, "items": []}
        # Le panier est gere cote frontend (Zustand) + sync user service.
        # On renvoie les items normalises pour cart_added.
        normalized = []
        for it in items:
            normalized.append({
                "product_id": str(it.get("product_id") or it.get("id") or ""),
                "name": str(it.get("name") or ""),
                "price": float(it.get("price") or 0),
                "quantity": int(it.get("quantity") or 1),
                "image": it.get("image") or "",
            })
        return {"items": normalized, "count": len(normalized), "ok": True}


_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry
