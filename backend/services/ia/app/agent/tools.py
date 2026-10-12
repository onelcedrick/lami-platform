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
                            "description": "Budget maximum en Ariary (MGA)",
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

    # -----------------------------------------------------------------------
    # Outils — Catalogue
    # -----------------------------------------------------------------------

    async def _search_products(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        # ✅ Mapping category → category_id (UUID)
        CATEGORY_ID_MAP = {
            "CPU": "0fb46772-f12e-4e8f-a494-d520c13c4637",
            "GPU": "435f979b-efa0-4ad6-8ae0-4243b90a4c40",
            "RAM": "580e0ae9-0b0c-44d7-9cb5-2c1847bbfb9b",
            "Stockage": "cd894b65-2f96-441e-9224-50ddb34f81bc",
            "Carte mere": "36fd69e9-8f94-4ff9-bd19-4b0b02ed7f69",
            "Alimentation": "1c34817e-5a8d-451c-b581-7d5e0aace94a",
            "Boitier": "25fb979f-d83f-47df-bf13-86a66227f89d",
            "Refroidissement": "4a350d5b-f978-48b1-833e-5054bde0e1cc",
            "Ecrans": "0fc32b07-be95-41ec-b73d-6740d1e3600d",
        }

        params: dict[str, Any] = {"limit": args.get("limit", 5)}
        search_term = (args.get("search") or "").strip()
        category = (args.get("category") or "").strip()

        if category:
            # ✅ Utiliser category_id (plus fiable que search)
            cat_id = CATEGORY_ID_MAP.get(category)
            if cat_id:
                params["category_id"] = cat_id
                # Ajouter le search en bonus si présent
                if search_term:
                    params["search"] = search_term
            else:
                # Fallback : search sur le nom de catégorie
                params["search"] = search_term or category
        elif search_term:
            params["search"] = search_term

        if args.get("max_price") is not None:
            params["max_price"] = args["max_price"]

        url = f"{self.settings.catalog_service_url}/api/v1/catalog/products"
        try:
            data = await self._http_get(url, params=params)
            products = data.get("data", [])

            simplified: list[dict[str, Any]] = []
            for p in products[: params["limit"]]:
                images = p.get("images") or []
                simplified.append(
                    {
                        "id": p.get("id"),
                        "name": p.get("name"),
                        "slug": p.get("slug"),
                        "brand": p.get("brand"),
                        "price": p.get("price"),
                        "stock": p.get("stock"),
                        "rating": p.get("rating"),
                        "image": images[0] if images else None,
                        "usage_tags": p.get("usage_tags", []),
                        "sku": p.get("sku"),
                        "category_id": p.get("category_id"),
                    }
                )

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

    # -----------------------------------------------------------------------
    # Outils — Support
    # -----------------------------------------------------------------------

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

    # -----------------------------------------------------------------------
    # Outils — Configuration PC (budget-aware + backtracking)
    # -----------------------------------------------------------------------

    async def _suggest_pc_build(
        self,
        args: dict,
        auth_token: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Any:
        usage = (args.get("usage") or "gaming").lower().replace("é", "e")
        budget = float(args.get("budget") or 0)

        # Si budget trop bas (< 100k), on suppose une erreur (euros) → conversion
        if 0 < budget < 100000:
            budget = budget * 4500  # approx EUR→MGA pour demos

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

        # ✅ Chercher par catégorie au lieu de search vide
        catalog: list[dict] = []
        for cat in ["CPU", "GPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier"]:
            r = await self._search_products(
                {"category": cat, "max_price": budget, "limit": 20},
                auth_token=auth_token,
            )
            catalog.extend(r.get("products") or [])

        # Fallback : chercher plus large sans limite de prix
        if not catalog:
            for term in [usage, "gaming", "pc", "ryzen", "rtx"]:
                r = await self._search_products(
                    {"search": term, "limit": 30},
                    auth_token=auth_token,
                )
                catalog.extend(r.get("products") or [])

        # Si toujours rien, chercher TOUT le catalogue (limité)
        if not catalog:
            r = await self._search_products(
                {"limit": 50},
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
            """Identifie si un produit correspond a un slot donne.
            Utilise UNIQUEMENT le SKU et le category_id (pas le nom, trop ambigu).
            """
            # ✅ Priorite 1 : SKU (tres fiable)
            sku = str(p.get("sku") or "").lower()
            sku_prefixes = {
                "CPU": ["cpu-", "proc-", "inte-"],
                "GPU": ["gpu-", "vga-", "video-card-"],
                "RAM": ["ram-", "mem-", "memo-"],
                "Stockage": ["ssd-", "hdd-", "sto-", "nvme-", "exte-"],
                "Carte mere": ["mb-", "mobo-", "motherboard-", "moth-"],
                "Alimentation": ["psu-", "alim-", "power-", "powe-"],
                "Boitier": ["case-", "boit-"],
                "Ecrans": ["mon-", "moni-", "scr-"],
                "Claviers": ["keyb-", "clav-"],
                "Souris": ["mous-", "sour-"],
                "Audio": ["soun-", "spea-", "head-"],
            }.get(slot, [])
            if sku and any(sku.startswith(p) for p in sku_prefixes):
                return True

            # ✅ Priorite 2 : category_id (fallback fiable)
            expected_cat_id = {
                "CPU": "0fb46772-f12e-4e8f-a494-d520c13c4637",
                "GPU": "435f979b-efa0-4ad6-8ae0-4243b90a4c40",
                "RAM": "580e0ae9-0b0c-44d7-9cb5-2c1847bbfb9b",
                "Stockage": "cd894b65-2f96-441e-9224-50ddb34f81bc",
                "Carte mere": "36fd69e9-8f94-4ff9-bd19-4b0b02ed7f69",
                "Alimentation": "1c34817e-5a8d-451c-b581-7d5e0aace94a",
                "Boitier": "25fb979f-d83f-47df-bf13-86a66227f89d",
                "Ecrans": "0fc32b07-be95-41ec-b73d-6740d1e3600d",
            }.get(slot, "")
            if expected_cat_id and str(p.get("category_id") or "") == expected_cat_id:
                return True

            # PAS de fallback par nom (source de faux positifs)
            return False

        # ✅ ALGORITHME BUDGET-AWARE v2 (corrige)
        #
        # Principe :
        # 1. Trier les slots par PRIORITE d'usage (GPU avant boitier, etc.)
        # 2. Pour chaque slot, chercher les candidats <= allocation cible
        # 3. Trier les candidats par PROXIMITE a l'allocation (ni trop cher, ni trop cheap)
        # 4. Backtracking avec reserve minimale (100k Ar par slot restant)
        #
        # ✅ Ordre optimal par usage (le + critique en premier)
        # Pour gaming : GPU AVANT CPU (le GPU fait 60% des perfs)
        # Pour bureautique/montage : CPU + RAM en priorite
        priority_map = {
            "gaming":        ["GPU", "CPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier"],
            "bureautique":   ["CPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier"],
            "montage video": ["CPU", "GPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier"],
            "creation":      ["CPU", "GPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier"],
        }
        ordered_slots = [
            s for s in priority_map.get(usage, priority_map["gaming"])
            if s in slots
        ]

        # Budget minimum vital par slot (en Ar) pour eviter les composants a 10k Ar
        MIN_SLOT_PRICE = {
            "CPU": 200_000,
            "GPU": 300_000,
            "RAM": 80_000,
            "Stockage": 50_000,
            "Carte mere": 100_000,
            "Alimentation": 80_000,
            "Boitier": 50_000,
            "Ecrans": 100_000,
        }

        def build_recursive(
            slot_idx: int,
            remaining: float,
            current: list,
        ) -> Optional[list]:
            """
            Essaie de remplir les slots en respectant le budget restant.
            Utilise un backtracking avec reserve minimale.
            """
            if slot_idx >= len(ordered_slots):
                return current

            slot = ordered_slots[slot_idx]

            # Reserve minimale pour les slots restants (evite de tout depenser)
            restants = ordered_slots[slot_idx + 1:]
            reserve = sum(MIN_SLOT_PRICE.get(s, 50_000) for s in restants)

            # Allocation cible pour ce slot (proportionnelle au budget initial)
            alloc_cible = slots.get(slot, 0.10) * budget

            # Candidats : produits du bon type, prix <= (remaining - reserve)
            # ✅ Tolerance GPU : on autorise jusqu'a 110% de l'allocation cible
            dispo = remaining - reserve
            if slot == "GPU":
                dispo = min(dispo, alloc_cible * 1.3)
            candidates = [
                p for p in products
                if match_slot(p, slot)
                and MIN_SLOT_PRICE.get(slot, 0) <= float(p.get("price") or 0) <= dispo
            ]

            if not candidates:
                # Pas de candidat pour ce slot → on continue sans
                return build_recursive(slot_idx + 1, remaining, current)

            # Trier par proximite a l'allocation cible (ni trop cher, ni trop cheap)
            # Score = distance relative a l'allocation cible
            def score(p: dict) -> float:
                price = float(p.get("price") or 0)
                # On prefere les produits proches de l'allocation, mais un peu en dessous
                target = alloc_cible * 0.9  # 90% de l'allocation = ideal
                return abs(price - target)

            candidates.sort(key=score)

            # Essayer le top 5 des candidats (backtracking limite)
            for chosen in candidates[:5]:
                price = float(chosen.get("price") or 0)
                build_item = {
                    "slot": slot,
                    "id": chosen.get("id"),
                    "name": chosen.get("name"),
                    "brand": chosen.get("brand"),
                    "price": price,
                    "sku": chosen.get("sku"),
                }
                result = build_recursive(
                    slot_idx + 1,
                    remaining - price,
                    current + [build_item],
                )
                if result is not None:
                    return result

            # Fallback : essayer sans ce slot
            return build_recursive(slot_idx + 1, remaining, current)

        build = build_recursive(0, budget, [])
        if build is None:
            build = []

        total = sum(c["price"] for c in build)

        # ✅ VÉRIFICATION FINALE : retirer les composants les plus chers si dépassement
        while total > budget and build:
            most_expensive = max(build, key=lambda c: c["price"])
            if len(build) == 1 and most_expensive["slot"] == "CPU":
                break
            build = [c for c in build if c["id"] != most_expensive["id"]]
            total = sum(c["price"] for c in build)

        # Réponse claire si aucun composant
        if not build:
            return {
                "usage": usage,
                "budget": budget,
                "currency": "MGA",
                "components": [],
                "suggested_components": [],
                "estimated_total": 0,
                "remaining_budget": budget,
                "within_budget": False,
                "slots_filled": 0,
                "error": (
                    f"Budget insuffisant ({budget:,.0f} Ar) pour une configuration {usage}. "
                    f"Essayez un budget supérieur."
                ).replace(",", " "),
            }

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