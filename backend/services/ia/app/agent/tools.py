"""
Outils (Function Calling) disponibles pour l'agent conversationnel.
Chaque outil appelle les microservices Go via HTTP.
"""

from typing import Any, Callable, Optional
from uuid import uuid4

import httpx

from app.core.config import get_settings


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


class ToolRegistry:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._tools: dict[str, ToolDefinition] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.register(
            ToolDefinition(
                name="search_products",
                description=(
                    "Recherche des produits dans le catalogue L'AMI "
                    "(CPU, GPU, RAM, PC complets, etc.). "
                    "Utiliser pour recommander ou trouver un composant."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "search": {
                            "type": "string",
                            "description": "Texte de recherche (nom, marque, usage)",
                        },
                        "category": {
                            "type": "string",
                            "description": "Categorie optionnelle (CPU, GPU, RAM, ...)",
                        },
                        "max_price": {
                            "type": "number",
                            "description": "Budget maximum en euros",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Nombre max de resultats (defaut 5)",
                        },
                    },
                    "required": [],
                },
                handler=self._search_products,
            )
        )
        self.register(
            ToolDefinition(
                name="get_product",
                description="Recupere le detail d'un produit par son identifiant.",
                parameters={
                    "type": "object",
                    "properties": {
                        "product_id": {
                            "type": "string",
                            "description": "Identifiant du produit",
                        },
                    },
                    "required": ["product_id"],
                },
                handler=self._get_product,
            )
        )
        self.register(
            ToolDefinition(
                name="list_categories",
                description="Liste les categories de produits disponibles.",
                parameters={"type": "object", "properties": {}, "required": []},
                handler=self._list_categories,
            )
        )
        self.register(
            ToolDefinition(
                name="create_support_ticket",
                description=(
                    "Cree un ticket de support technique pour le client. "
                    "Utiliser quand le probleme necessite une intervention humaine."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "category": {
                            "type": "string",
                            "description": "materiel | logiciel | reseau | commande | autre",
                        },
                        "priority": {
                            "type": "string",
                            "description": "low | medium | high | critical",
                        },
                    },
                    "required": ["title", "description", "category"],
                },
                handler=self._create_ticket,
            )
        )
        self.register(
            ToolDefinition(
                name="suggest_pc_build",
                description=(
                    "Propose une configuration PC complete selon usage et budget. "
                    "Retourne des recommandations basees sur le catalogue."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "usage": {
                            "type": "string",
                            "description": "gaming | bureautique | montage video | creation",
                        },
                        "budget": {
                            "type": "number",
                            "description": "Budget total en Ariary (MGA), ex: 3000000",
                        },
                    },
                    "required": ["usage", "budget"],
                },
                handler=self._suggest_pc_build,
            )
        )

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def list_schemas(self) -> list[dict[str, Any]]:
        return [t.schema() for t in self._tools.values()]

    def get(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    async def execute(
        self,
        name: str,
        arguments: dict[str, Any],
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        tool = self._tools.get(name)
        if not tool:
            return {"error": f"Outil inconnu: {name}"}
        try:
            return await tool.handler(
                arguments,
                auth_token=auth_token,
                user_id=user_id,
            )
        except Exception as e:
            return {"error": str(e)}

    async def _http_get(
        self,
        url: str,
        params: Optional[dict] = None,
        auth_token: Optional[str] = None,
    ) -> Any:
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def _http_post(
        self,
        url: str,
        body: dict,
        auth_token: Optional[str] = None,
    ) -> Any:
        headers = {"Content-Type": "application/json"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def _search_products(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        params: dict[str, Any] = {"limit": args.get("limit", 5)}
        if args.get("search"):
            params["search"] = args["search"]
        if args.get("category"):
            params["category_id"] = args["category"]
        if args.get("max_price") is not None:
            params["max_price"] = args["max_price"]

        url = f"{self.settings.catalog_service_url}/api/v1/catalog/products"
        try:
            data = await self._http_get(url, params=params)
            products = data.get("data", [])
            simplified = [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "brand": p.get("brand"),
                    "price": p.get("price"),
                    "stock": p.get("stock"),
                    "usage_tags": p.get("usage_tags", []),
                }
                for p in products[: params["limit"]]
            ]
            return {"products": simplified, "count": len(simplified)}
        except Exception as e:
            return {"error": f"Catalogue indisponible: {e}", "products": []}

    async def _get_product(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        pid = args.get("product_id")
        url = f"{self.settings.catalog_service_url}/api/v1/catalog/products/{pid}"
        try:
            data = await self._http_get(url)
            return data.get("data", data)
        except Exception as e:
            return {"error": str(e)}

    async def _list_categories(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        url = f"{self.settings.catalog_service_url}/api/v1/catalog/categories"
        try:
            data = await self._http_get(url)
            cats = data.get("data", [])
            return {
                "categories": [
                    {"id": c.get("id"), "name": c.get("name"), "slug": c.get("slug")}
                    for c in cats
                ]
            }
        except Exception as e:
            return {"error": str(e), "categories": []}

    async def _create_ticket(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        if not auth_token:
            return {
                "error": "Authentification requise pour creer un ticket. "
                "Demandez au client de se connecter."
            }
        url = f"{self.settings.ticket_service_url}/api/v1/tickets"
        body = {
            "title": args.get("title"),
            "description": args.get("description"),
            "category": args.get("category", "autre"),
            "priority": args.get("priority", "medium"),
        }
        try:
            data = await self._http_post(url, body, auth_token=auth_token)
            ticket = data.get("data", {})
            return {
                "success": True,
                "ticket_number": ticket.get("ticket_number"),
                "ticket_id": ticket.get("id"),
                "status": ticket.get("status"),
            }
        except Exception as e:
            return {"error": f"Impossible de creer le ticket: {e}"}

    async def _suggest_pc_build(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        usage = (args.get("usage") or "gaming").lower().replace("é", "e")
        budget = float(args.get("budget") or 0)
        # Si budget trop bas (< 100k), on suppose une erreur (euros) → convertir approx
        if 0 < budget < 100000:
            budget = budget * 4500  # approx EUR→MGA pour demos

        # Allocation budget par slot selon usage (Madagascar / Ar)
        allocations = {
            "gaming": {
                "CPU": 0.22, "GPU": 0.35, "RAM": 0.12, "Stockage": 0.10,
                "Carte mere": 0.10, "Alimentation": 0.06, "Boitier": 0.05,
            },
            "bureautique": {
                "CPU": 0.28, "RAM": 0.18, "Stockage": 0.18,
                "Carte mere": 0.14, "Alimentation": 0.08, "Boitier": 0.08, "Ecrans": 0.06,
            },
            "montage video": {
                "CPU": 0.28, "GPU": 0.25, "RAM": 0.18, "Stockage": 0.14,
                "Carte mere": 0.08, "Alimentation": 0.04, "Boitier": 0.03,
            },
            "creation": {
                "CPU": 0.26, "GPU": 0.22, "RAM": 0.20, "Stockage": 0.14,
                "Carte mere": 0.10, "Alimentation": 0.04, "Boitier": 0.04,
            },
        }
        slots = allocations.get(usage, allocations["gaming"])

        # Charger catalogue large
        result = await self._search_products(
            {"search": "", "max_price": budget, "limit": 50},
            auth_token=auth_token,
        )
        catalog = result.get("products") or []
        if not catalog:
            # fallback recherches par tags usage
            for term in [usage, "gaming", "pc"]:
                r = await self._search_products(
                    {"search": term, "max_price": budget, "limit": 20},
                    auth_token=auth_token,
                )
                catalog.extend(r.get("products") or [])

        # Dedup
        seen = set()
        products = []
        for p in catalog:
            pid = p.get("id")
            if pid and pid not in seen:
                seen.add(pid)
                products.append(p)

        def match_slot(p: dict, slot: str) -> bool:
            blob = " ".join([
                str(p.get("name") or ""),
                str(p.get("brand") or ""),
                " ".join(p.get("usage_tags") or []),
                str(p.get("category_name") or ""),
                str(p.get("sku") or ""),
            ]).lower()
            keys = {
                "CPU": ["cpu", "ryzen", "intel", "core i", "processeur"],
                "GPU": ["gpu", "rtx", "gtx", "radeon", "geforce", "carte graphique"],
                "RAM": ["ram", "ddr4", "ddr5", "memoire"],
                "Stockage": ["ssd", "hdd", "nvme", "stockage"],
                "Carte mere": ["carte mere", "motherboard", "b550", "b650", "z790"],
                "Alimentation": ["psu", "alimentation", "watt"],
                "Boitier": ["boitier", "case", "tower"],
                "Ecrans": ["ecran", "monitor", "afficheur"],
            }.get(slot, [slot.lower()])
            return any(k in blob for k in keys)

        build = []
        remaining = budget
        for slot, ratio in slots.items():
            cap = budget * ratio * 1.15  # souplesse 15%
            candidates = [
                p for p in products
                if match_slot(p, slot) and float(p.get("price") or 0) <= min(cap, remaining)
            ]
            candidates.sort(key=lambda p: float(p.get("price") or 0), reverse=True)
            if not candidates:
                # elargir sans cap strict
                candidates = [p for p in products if match_slot(p, slot)]
                candidates.sort(key=lambda p: float(p.get("price") or 0))
            if candidates:
                chosen = candidates[0]
                price = float(chosen.get("price") or 0)
                build.append({
                    "slot": slot,
                    "id": chosen.get("id"),
                    "name": chosen.get("name"),
                    "brand": chosen.get("brand"),
                    "price": price,
                    "sku": chosen.get("sku"),
                })
                remaining -= price
                # retirer le produit choisi
                products = [p for p in products if p.get("id") != chosen.get("id")]

        total = sum(c["price"] for c in build)
        return {
            "usage": usage,
            "budget": budget,
            "currency": "MGA",
            "components": build,
            "suggested_components": build,
            "estimated_total": round(total, 0),
            "remaining_budget": round(budget - total, 0),
            "within_budget": total <= budget,
            "slots_filled": len(build),
            "note": (
                "Configuration indicative (Ar) selon usage et budget. "
                "Verifiez compatibilite socket CPU / carte mere / PSU."
            ),
        }


_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry
