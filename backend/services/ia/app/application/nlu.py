"""NLU hybride : regles deterministes d'abord, LLM en arbitrage.

Pourquoi : chaque appel LLM coute ~1 s et du quota (8000 tokens/minute en
free tier, PAR modele). Sur les intentions non ambigues (budget chiffre,
categorie du catalogue, demande de ticket, hors-sujet) les regles sont
aussi fiables que le LLM et coutent 0 ms. Le LLM n'est appele que pour
arbitrer les cas flous, et son resultat est mis en cache.

`nlu_strategy` : hybrid (defaut) | rules (0 appel LLM) | llm (toujours).
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from app.infrastructure.catalog_cache import _tokens, infer_categories

logger = logging.getLogger("ia.nlu")

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_MAX = 512

# Les montants ne sont PAS des mots-cles produit : "2 000 000 Ar" laisserait
# le token "000", qui declenche le garde-fou "modele chiffre" du cache
# catalogue et vide les resultats de recherche.
_AMOUNT_RE = re.compile(r"\d[\d\s.,]*\s*(?:ar|ariary|mga|millions?|m)\b", re.I)


def _key(message: str) -> str:
    return re.sub(r"\s+", " ", (message or "").lower()).strip()[:300]


def rules_parse(message: str) -> dict:
    """Analyse deterministe (aucun I/O, aucun LLM)."""
    from app.application.orchestrator import (
        extract_budget, extract_usage, fallback_intent,
    )

    intent = fallback_intent(message)
    cats = infer_categories(message)
    # Une categorie du catalogue reconnue = demande produit, jamais "salutation"
    # (ex. "Montrez-moi vos processeurs AMD" : aucun mot-cle de la liste produit)
    if intent == "salutation" and cats:
        intent = "produit"
    budget = extract_budget(message)
    clean = _AMOUNT_RE.sub(" ", message)
    toks = [t for t in _tokens(clean) if not re.fullmatch(r"0{2,}", t)]
    keywords = " ".join(toks[:6])[:60]
    return {
        "intent": intent,
        "keywords": keywords or message[:60],
        "category": cats[0] if cats else None,
        "query": message,
        "budget": budget if intent == "configuration" else None,
        "usage": extract_usage(message) if intent == "configuration" else None,
        "max_price": budget if intent != "configuration" else None,
        "nlu_source": "rules",
    }


def _ambiguous(parsed: dict, message: str) -> bool:
    """Le LLM n'apporte quelque chose que dans ces cas."""
    intent = parsed.get("intent")
    if intent == "salutation" and len(message.strip()) > 28:
        return True
    if intent == "produit" and not parsed.get("category"):
        return True
    if intent == "configuration" and not parsed.get("budget"):
        return True
    return False


async def analyze(llm: Any, settings: Any, message: str, hist: str = "") -> dict:
    from app.application.orchestrator import SYSTEM_NLU_PROMPT, parse_nlu

    strategy = (getattr(settings, "nlu_strategy", "hybrid") or "hybrid").lower()
    base = rules_parse(message)

    if strategy == "rules":
        return base
    if strategy != "llm" and not _ambiguous(base, message):
        logger.info("NLU[rules] intent=%s category=%s budget=%s",
                    base["intent"], base["category"], base["budget"])
        return base

    key = _key(message)
    ttl = float(getattr(settings, "nlu_cache_ttl_s", 900.0))
    hit = _cache.get(key)
    if hit and (time.monotonic() - hit[0]) < ttl:
        cached = dict(hit[1])
        cached["nlu_source"] = "cache"
        return cached

    res = await llm.generate(
        prompt=f"Historique recent :\n{hist or 'Aucun'}\n"
               f"Nouvelle demande : {message}",
        system=SYSTEM_NLU_PROMPT,
        temperature=0.0,
        json_mode=True,
        purpose="nlu",
        max_tokens=getattr(settings, "nlu_max_tokens", 512),
    )
    raw = res.get("content") or ""
    if not raw:
        logger.warning("NLU LLM sans reponse (%s) -> regles", res.get("error"))
        return base

    parsed = parse_nlu(raw, message)
    for field in ("category", "budget", "usage", "max_price"):
        if not parsed.get(field) and base.get(field):
            parsed[field] = base[field]
    parsed["nlu_source"] = "llm"
    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
    _cache[key] = (time.monotonic(), dict(parsed))
    return parsed
