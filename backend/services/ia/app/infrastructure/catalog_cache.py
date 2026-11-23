"""
Cache catalogue local (TTL) + recherche / filtrage / scoring cote Python.

L'API catalogue Go n'honore pas `category`, `max_price`, `sort_by` et son
`search` ne fait qu'un substring match sur une chaine unique. On charge donc
le catalogue (~840 produits) et on applique nous-memes :
  - tokenisation + scoring multi-termes
  - filtre categorie / budget / stock
  - tri explicite (prix, meilleures ventes)

v3 — garde-fous anti-hallucination :
  - familles hors catalogue (iPhone, PS5, MacBook, drone...) -> 0 resultat
  - gate modele : si la requete cite un modele chiffre (9950x, 5090, 850w),
    au moins un doit matcher, sinon 0 resultat (pas de fallback categorie)
  - tokens generiques (pro, max, plus, oc, rgb) exclus du scoring
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
import unicodedata
from typing import Any, Optional

import httpx

from app.core.config import get_settings

logger = logging.getLogger("ia.catalog")

CACHE_TTL_S = 300.0

CATEGORY_NAMES = [
    "CPU", "GPU", "RAM", "Stockage", "Carte mere", "Alimentation", "Boitier",
    "Refroidissement", "Peripheriques", "PC Complets", "Imprimante", "Moniteur",
    "Ecrans", "Claviers", "Souris", "Audio", "Logiciels", "Reseau",
    "Ondulaire", "Pate thermique",
]

CATEGORY_HINTS: dict[str, list[str]] = {
    "Pate thermique": ["pate thermique", "thermal paste", "tm30", "xtm70"],
    "Carte mere": ["carte mere", "cartes meres", "motherboard", "mainboard",
                   "b650", "b550", "x670", "z790", "b760", "a620", "am5", "am4",
                   "lga1700", "lga1851", "tomahawk", "strix b", "pro rs"],
    "GPU": ["gpu", "carte graphique", "cartes graphiques", "geforce", "rtx",
            "gtx", "radeon", "graphique", "video card"],
    "CPU": ["cpu", "processeur", "processeurs", "processor", "ryzen",
            "core i3", "core i5", "core i7", "core i9", "pentium", "celeron",
            "threadripper", "athlon", "7800x3d", "9950x"],
    "RAM": ["ram", "memoire vive", "barrette", "barrettes", "ddr4", "ddr5",
            "dimm", "vengeance", "32gb", "16gb", "6000"],
    "Stockage": ["ssd", "hdd", "nvme", "disque dur", "disque", "stockage",
                 "m 2", "sata", "990 pro", "sn850", "2tb", "1tb"],
    "Alimentation": ["alimentation", "alimentations", "alim", "psu",
                     "850w", "750w", "650w", "550w", "1000w", "80 plus", "80+"],
    "Boitier": ["boitier", "boitiers", "moyen tour", "grande tour", "case"],
    "Refroidissement": ["ventirad", "refroidissement", "watercooling", "aio",
                        "noctua", "ventilateur", "cooler", "nh d15"],
    "Moniteur": ["moniteur", "moniteurs", "monitor", "oled", "144hz", "165hz",
                 "27 pouces", "24 pouces", "odyssey", "dalle"],
    "Ecrans": ["ecran", "ecrans"],
    "Claviers": ["clavier", "claviers", "keyboard"],
    "Souris": ["souris", "mouse"],
    "Audio": ["casque", "casques", "audio", "enceinte", "enceintes",
              "micro", "headset", "ecouteurs"],
    "Peripheriques": ["peripherique", "peripheriques", "webcam", "camera"],
    "PC Complets": ["pc complet", "pc complets", "pc gaming", "pc portable",
                    "pc gamer", "ordinateur complet", "unite centrale"],
    "Imprimante": ["imprimante", "imprimantes", "canon", "epson", "laserjet"],
    "Reseau": ["reseau", "wifi", "routeur", "tp link", "archer", "edup"],
    "Ondulaire": ["onduleur", "onduleurs", "ondulaire", "ups", "apc"],
    "Logiciels": ["logiciel", "logiciels", "licence", "antivirus", "windows 11 pro"],
}

STOPWORDS = {
    "je", "j", "tu", "il", "elle", "nous", "vous", "me", "moi", "mon", "ma", "mes",
    "le", "la", "les", "un", "une", "des", "du", "de", "d", "ce", "cet", "cette",
    "a", "au", "aux", "en", "et", "ou", "pour", "avec", "sans", "sur", "dans",
    "cherche", "cherch", "chercher", "veux", "voudrais", "souhaite", "besoin",
    "montre", "montrez", "propose", "proposez", "donne", "donnez", "voir",
    "avoir", "avez", "vendez", "vend", "disponible", "stock", "quel", "quelle",
    "quels", "quelles", "produit", "produits", "article", "articles",
    "compatible", "compatibilite", "budget", "prix", "cout", "coute", "combien",
    "ariary", "ar", "mga", "million", "millions", "max", "maximum", "minimum",
    "moins", "plus", "tres", "bien", "bon", "bonne", "meilleur", "meilleure",
    "petit", "petite", "grand", "grande", "merci", "bonjour", "salut", "svp",
    "stp", "please", "aussi", "environ", "type", "sorte", "genre",
    "sont", "vos", "notre", "nos", "votre", "chers", "cher", "chere", "cheres",
    "est", "ce", "que", "qui", "quoi", "faites", "fait", "moi", "ya", "il",
    "to", "go", "gb", "tb", "hz", "mm", "cm", "kg", "va",
}

# Tokens marketing non discriminants : ne doivent jamais creer un match seuls.
GENERIC_TOKENS = {
    "pro", "max", "plus", "ultra", "oc", "rgb", "black", "white", "mini",
    "lite", "edition", "series", "version", "model", "new", "gaming",
}

# Familles de produits que L'AMI ne vend pas -> reponse "hors catalogue".
OUT_OF_CATALOG = [
    r"\biphone\b", r"\bipad\b", r"\bairpods\b", r"\bapple watch\b",
    r"\bmacbook\b", r"\bimac\b", r"\bmac mini\b", r"\bmac studio\b", r"\bmac pro\b",
    r"\bps5\b", r"\bps4\b", r"\bplaystation\b", r"\bxbox\b", r"\bnintendo\b",
    r"\bconsole de jeu\b",
    r"\bdji\b", r"\bmavic\b", r"\bdrone\b",
    r"\bsmartphone\b", r"\btablette\b", r"\bgalaxy s\d", r"\bpixel \d",
    r"\btelevision\b", r"\bsmart tv\b", r"\brefrigerateur\b", r"\bfrigo\b",
    r"\bmachine a laver\b", r"\bclimatiseur\b",
]

CHEAP_PATTERNS = [
    r"\bmoins cher", r"\bpas cher", r"\beconomique\b", r"\bpetit prix\b",
    r"\babordable\b", r"\bentree de gamme\b",
]
BESTSELLER_PATTERNS = [
    r"\bmeilleur(?:e?s)? vente", r"\bbest ?seller", r"\bplus vendu",
    r"\bpopulaire", r"\bles plus vendus\b",
]

UNIT_ALIASES = {"2to": "2tb", "1to": "1tb", "4to": "4tb", "8to": "8tb"}


def _norm(text: Any) -> str:
    s = str(text or "").lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("-", " ").replace("/", " ").replace("_", " ").replace("+", " plus ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _tokens(text: str) -> list[str]:
    out: list[str] = []
    for t in _norm(text).split():
        t = UNIT_ALIASES.get(t, t)
        if len(t) < 2 or t in STOPWORDS:
            continue
        if t.isdigit() and len(t) < 3:
            continue
        if t not in out:
            out.append(t)
        parts = re.findall(r"[a-z]+|\d+", t)
        if len(parts) > 1:
            for p in parts:
                if len(p) >= 2 and p not in STOPWORDS and p not in out:
                    out.append(p)
    return out


def _is_model_token(t: str) -> bool:
    return len(t) >= 3 and any(c.isdigit() for c in t)


def _model_hit(hay: str, model_tokens: list[str]) -> bool:
    if not model_tokens:
        return True
    for t in model_tokens:
        if t in hay:
            return True
        num = re.match(r"(\d{3,})", t)
        if num and num.group(1) in hay:
            return True
    return False


def is_out_of_catalog(text: str) -> bool:
    n = _norm(text)
    return any(re.search(p, n) for p in OUT_OF_CATALOG)


def detect_sort(text: str) -> Optional[str]:
    n = _norm(text)
    if any(re.search(p, n) for p in BESTSELLER_PATTERNS):
        return "sales_desc"
    if any(re.search(p, n) for p in CHEAP_PATTERNS):
        return "price_asc"
    return None


def _price(p: dict) -> float:
    try:
        return float(p.get("price") or 0)
    except (TypeError, ValueError):
        return 0.0


def _stock(p: dict) -> int:
    try:
        return int(float(p.get("stock") or 0))
    except (TypeError, ValueError):
        return 0


def _rating(p: dict) -> float:
    try:
        return float(p.get("rating") or 0)
    except (TypeError, ValueError):
        return 0.0


def _sales(p: dict) -> int:
    try:
        return int(float(p.get("sales_count") or 0))
    except (TypeError, ValueError):
        return 0


def _unwrap_list(payload: Any) -> list[dict]:
    if isinstance(payload, dict):
        payload = payload.get("data", payload)
    if isinstance(payload, dict):
        payload = payload.get("items") or payload.get("products") or []
    return [x for x in payload if isinstance(x, dict)] if isinstance(payload, list) else []


def resolve_categories(raw: Optional[str]) -> list[str]:
    if not raw:
        return []
    n = _norm(raw)
    if not n:
        return []
    exact = [c for c in CATEGORY_NAMES if _norm(c) == n]
    if exact:
        return exact
    out: list[str] = []
    for real, hints in CATEGORY_HINTS.items():
        if any(n == _norm(h) or n in _norm(h) or _norm(h) in n for h in hints):
            out.append(real)
    return out


def infer_categories(text: str) -> list[str]:
    n = _norm(text)
    found: list[tuple[int, str]] = []
    for real, hints in CATEGORY_HINTS.items():
        best = -1
        for h in hints:
            hn = _norm(h)
            if not hn:
                continue
            if len(hn) <= 3:
                m = re.search(rf"\b{re.escape(hn)}\b", n)
                pos = m.start() if m else -1
            else:
                pos = n.find(hn)
            if pos >= 0 and (best < 0 or pos < best):
                best = pos
        if best >= 0:
            found.append((best, real))
    found.sort()
    return [c for _, c in found]


def _score(hay: str, tokens: list[str]) -> float:
    if not tokens:
        return 0.0
    hits = 0
    acc = 0.0
    for t in tokens:
        if t in hay:
            hits += 1
            acc += 1.0 + min(len(t), 8) * 0.05
    if hits == 0:
        return 0.0
    coverage = hits / len(tokens)
    return acc * (0.35 + 0.65 * coverage)


class CatalogCache:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._products: list[dict] = []
        self._cat_names: dict[str, str] = {}
        self._by_cat: dict[str, list[dict]] = {}
        self._loaded_at = 0.0
        self._lock = asyncio.Lock()

    async def ensure_loaded(self, force: bool = False) -> None:
        if self._fresh() and not force:
            return
        async with self._lock:
            if self._fresh() and not force:
                return
            try:
                await self._load()
            except Exception as exc:
                logger.warning("Chargement catalogue impossible : %s", exc)
                if not self._products:
                    raise

    def _fresh(self) -> bool:
        return bool(self._products) and (time.monotonic() - self._loaded_at) < CACHE_TTL_S

    async def _load(self) -> None:
        base = self.settings.catalog_url.rstrip("/")
        async with httpx.AsyncClient(timeout=30.0) as client:
            r_cat = await client.get(f"{base}/api/v1/catalog/categories")
            cats = _unwrap_list(r_cat.json())
            r_prod = await client.get(
                f"{base}/api/v1/catalog/products", params={"limit": 5000}
            )
            prods = _unwrap_list(r_prod.json())

        names = {str(c.get("id")): str(c.get("name") or "") for c in cats if c.get("id")}
        enriched: list[dict] = []
        for p in prods:
            q = dict(p)
            cname = names.get(str(p.get("category_id") or ""), "")
            q["category"] = cname
            parts: list[Any] = [p.get("name"), p.get("brand"),
                                p.get("description"), p.get("sku"), cname]
            tags = p.get("tags")
            if isinstance(tags, list):
                parts += [t for t in tags if isinstance(t, (str, int))]
            attrs = p.get("attributes")
            if isinstance(attrs, dict):
                parts += [v for v in attrs.values() if isinstance(v, (str, int, float))]
            q["_hay"] = _norm(" ".join(str(x) for x in parts if x))
            enriched.append(q)

        by_cat: dict[str, list[dict]] = {}
        for q in enriched:
            by_cat.setdefault(q["category"], []).append(q)

        self._cat_names = names
        self._products = enriched
        self._by_cat = by_cat
        self._loaded_at = time.monotonic()
        logger.info("Catalogue en cache : %s produits / %s categories",
                    len(enriched), len(names))

    @property
    def products(self) -> list[dict]:
        return self._products

    def categories(self) -> list[dict]:
        return [{"id": k, "name": v} for k, v in self._cat_names.items()]

    def by_category(self, name: str) -> list[dict]:
        return self._by_cat.get(name, [])

    def find(self, product_id: str = "", slug: str = "") -> Optional[dict]:
        for p in self._products:
            if product_id and str(p.get("id")) == str(product_id):
                return p
            if slug and str(p.get("slug")) == str(slug):
                return p
        return None

    def cheapest(self, category: str) -> Optional[float]:
        pool = [_price(p) for p in self.by_category(category)
                if _price(p) > 0 and (not p.get("status") or p.get("status") == "active")]
        return min(pool) if pool else None

    async def search(
        self,
        query: str = "",
        category: Optional[str] = None,
        max_price: Optional[float] = None,
        limit: int = 5,
        in_stock_only: bool = False,
    ) -> list[dict]:
        await self.ensure_loaded()
        raw = str(query or "")

        # Garde-fou 1 : famille hors catalogue
        if is_out_of_catalog(raw):
            logger.info("Recherche hors catalogue : %r", raw[:60])
            return []

        sort_mode = detect_sort(raw)
        cats = resolve_categories(category) or infer_categories(raw)

        if cats:
            pool: list[dict] = []
            seen: set[str] = set()
            for c in cats:
                for p in self.by_category(c):
                    pid = str(p.get("id"))
                    if pid not in seen:
                        seen.add(pid)
                        pool.append(p)
        else:
            pool = self._products

        tokens = _tokens(raw)
        model_toks = [t for t in tokens if _is_model_token(t)]
        score_toks = [t for t in tokens if t not in GENERIC_TOKENS]
        primary = cats[0] if cats else None

        filtered: list[dict] = []
        for p in pool:
            if p.get("status") and p.get("status") != "active":
                continue
            price = _price(p)
            if max_price is not None and price > float(max_price):
                continue
            if in_stock_only and _stock(p) <= 0:
                continue
            # Garde-fou 2 : un modele chiffre doit reellement matcher
            if not _model_hit(p.get("_hay", ""), model_toks):
                continue
            filtered.append(p)

        if sort_mode == "price_asc":
            filtered.sort(key=lambda p: (_price(p), -_stock(p)))
            chosen = filtered
        elif sort_mode == "sales_desc":
            filtered.sort(key=lambda p: (-_sales(p), -_rating(p), _price(p)))
            chosen = filtered
        elif score_toks:
            scored: list[tuple[float, dict]] = []
            for p in filtered:
                s = _score(p.get("_hay", ""), score_toks)
                if s > 0 and primary and p.get("category") == primary:
                    s += 1.5
                if s > 0:
                    scored.append((s, p))
            scored.sort(key=lambda x: (-x[0], _price(x[1])))
            chosen = [p for _, p in scored]
        elif cats:
            filtered.sort(key=lambda p: (-_rating(p), -_stock(p), _price(p)))
            chosen = filtered
        else:
            chosen = []

        out: list[dict] = []
        seen2: set[str] = set()
        for p in chosen:
            pid = str(p.get("id"))
            if pid in seen2:
                continue
            seen2.add(pid)
            out.append({k: v for k, v in p.items() if not k.startswith("_")})
            if len(out) >= max(1, int(limit)):
                break
        return out


_cache: Optional[CatalogCache] = None


async def get_catalog_cache() -> CatalogCache:
    global _cache
    if _cache is None:
        _cache = CatalogCache()
    await _cache.ensure_loaded()
    return _cache
