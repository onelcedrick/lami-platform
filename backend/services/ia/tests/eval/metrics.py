"""
Métriques d'évaluation pour le Golden Set L'AMI.

Ce module est PUR (pas d'I/O, pas de réseau). Il prend en entrée :
- une question du golden set
- la réponse réelle du service IA (ChatResponse)

Et retourne un dict de métriques pour cette question.

Conventions :
- Tous les scores sont en [0.0, 1.0] sauf indication contraire
- Les latences sont en ms
- Les prix sont en Ariary (MGA)
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


# ============================================================
# Dataclasses de résultat
# ============================================================

@dataclass
class QuestionResult:
    """Résultat d'évaluation d'une question."""
    question_id: str
    category: str
    theme: str
    question: str
    mode_expected: str
    mode_actual: str
    latency_ms: int
    http_status: int
    raw_response: dict

    # Métriques booléennes (pass/fail)
    mode_match: bool = False
    latency_ok: bool = False

    # Métriques RAG
    rag_source_hit: bool = False
    rag_sources_count: int = 0
    rag_best_score: float = 0.0
    rag_content_match: bool = False

    # Métriques Function Calling
    fc_tool_match: bool = False
    fc_args_match: bool = False
    fc_products_count: int = 0

    # Métriques Budget
    budget_respected: bool = False
    budget_total_mga: float = 0.0
    budget_max_mga: float = 0.0
    budget_slots_filled: int = 0

    # Métriques Guardrails
    guardrail_refused: bool = False
    guardrail_no_hallucination: bool = False
    guardrail_length_ok: bool = True

    # Score global (0..1)
    score: float = 0.0

    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ============================================================
# Helpers texte
# ============================================================

def _normalize(text: str) -> str:
    """Normalise un texte pour comparaison (lowercase + sans accents + sans ponctuation)."""
    if not text:
        return ""
    text = text.lower()
    # Retire les accents basiques
    for src, dst in [
        ("à", "a"), ("â", "a"), ("ä", "a"),
        ("é", "e"), ("è", "e"), ("ê", "e"), ("ë", "e"),
        ("î", "i"), ("ï", "i"),
        ("ô", "o"), ("ö", "o"),
        ("ù", "u"), ("û", "u"), ("ü", "u"),
        ("ç", "c"),
        ("'", " "), ("’", " "),
        ("\u00a0", " "),  # espace insécable
    ]:
        text = text.replace(src, dst)
    # Retire la ponctuation résiduelle
    text = re.sub(r"[.,;:!?()\[\]{}\"'`«»]", " ", text)
    # Normalise les espaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _contains_any(text: str, needles: list[str]) -> bool:
    """Retourne True si AU MOINS UN des needles est présent dans text (insensible casse/accents)."""
    if not text or not needles:
        return False
    norm = _normalize(text)
    for n in needles:
        if _normalize(n) in norm:
            return True
    return False


def _contains_all(text: str, needles: list[str]) -> bool:
    """Retourne True si TOUS les needles sont présents."""
    if not text or not needles:
        return False
    norm = _normalize(text)
    return all(_normalize(n) in norm for n in needles)


def _extract_numbers(text: str) -> list[float]:
    """Extrait tous les nombres d'un texte (gère 1 000 000 et 1,5 million)."""
    if not text:
        return []
    # Normalise les espaces dans les nombres : "2 300 000" -> "2300000"
    t = re.sub(r"(\d)\s+(\d)", r"\1\2", text)
    t = re.sub(r"(\d)\s+(\d)", r"\1\2", t)  # double passe pour 3 groupes
    # Remplace virgule décimale
    t = re.sub(r"(\d),(\d)", r"\1.\2", t)
    # Trouve les nombres
    nums = re.findall(r"\d+(?:\.\d+)?", t)
    return [float(n) for n in nums]


def _extract_amounts_mga(text: str) -> list[float]:
    """Extrait les montants en Ariary (supporte 'millions', 'M Ar', etc.)."""
    if not text:
        return []
    amounts: list[float] = []
    lower = _normalize(text)

    # "X millions" ou "X,X millions"
    for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*millions?", lower):
        try:
            amounts.append(float(m.group(1).replace(",", ".")) * 1_000_000)
        except ValueError:
            pass

    # "X Ar" ou "X ariary" ou "X MGA"
    for m in re.finditer(r"(\d[\d\s]*)\s*(ar|ariary|mga)\b", lower):
        raw = m.group(1).replace(" ", "")
        try:
            amounts.append(float(raw))
        except ValueError:
            pass

    return amounts


# ============================================================
# Métriques : Mode & Latence
# ============================================================

def eval_mode(expected: str, actual: str) -> bool:
    """Le mode détecté correspond-il à l'attendu ?"""
    if expected == "auto":
        return True  # pas de contrainte
    return expected == actual


def eval_latency(latency_ms: int, max_ms: Optional[int]) -> bool:
    if max_ms is None:
        return True
    return latency_ms <= max_ms


# ============================================================
# Métriques : RAG
# ============================================================

def eval_rag_sources(
    response: dict,
    expected: dict,
) -> tuple[bool, int, float]:
    """
    Vérifie :
    - min_sources : nombre minimum de sources retournées
    - source_titles_should_include_any : au moins UNE source avec un titre attendu
    Retourne (hit, count, best_score).
    """
    sources = response.get("sources") or []
    count = len(sources)
    best_score = 0.0
    if sources:
        scores = [float(s.get("score", 0)) for s in sources]
        best_score = max(scores) if scores else 0.0

    min_sources = expected.get("min_sources", 0)
    if count < min_sources:
        return False, count, best_score

    expected_titles = expected.get("source_titles_should_include_any", [])
    if not expected_titles:
        return True, count, best_score  # pas de contrainte de titre

    found = False
    for s in sources:
        title = s.get("title", "")
        if _contains_any(title, expected_titles):
            found = True
            break
    return found, count, best_score


def eval_rag_content(response: dict, expected: dict) -> bool:
    """Vérifie que la réponse contient les mots-clés attendus (insensible casse/accents)."""
    reply = response.get("reply", "")
    needles = expected.get("response_contains_any", [])
    if not needles:
        return True
    return _contains_any(reply, needles)


# ============================================================
# Métriques : Function Calling
# ============================================================

def eval_fc_tool(response: dict, expected: dict) -> tuple[bool, bool, int]:
    """
    Vérifie :
    - Au moins UN tool_call dont le nom est dans la liste attendue
    - Les arguments contiennent les paires attendues (arguments_contain)
    - Nombre de produits retournés (search_products)
    Retourne (tool_match, args_match, products_count).
    """
    tool_calls = response.get("tool_calls") or []
    expected_tools = expected.get("tool_calls", [])

    if not expected_tools:
        # Pas de contrainte tool → OK
        return True, True, len(response.get("products") or [])

    # Nom du tool
    actual_names = [tc.get("name") for tc in tool_calls]
    expected_names = [et.get("name") for et in expected_tools]

    tool_match = any(n in expected_names for n in actual_names)

    # Arguments
    args_match = False
    if tool_match:
        for expected_tool in expected_tools:
            expected_name = expected_tool.get("name")
            expected_args = expected_tool.get("arguments_contain") or {}
            for actual_tc in tool_calls:
                if actual_tc.get("name") != expected_name:
                    continue
                actual_args = actual_tc.get("arguments") or {}
                if all(
                    _normalize(str(actual_args.get(k, ""))) and
                    _normalize(str(v)) in _normalize(str(actual_args.get(k, "")))
                    for k, v in expected_args.items()
                ):
                    args_match = True
                    break
            if args_match:
                break
    else:
        args_match = False

    products = response.get("products") or []
    return tool_match, args_match, len(products)


def eval_fc_products(products_count: int, expected: dict) -> bool:
    min_count = expected.get("products_count_min")
    if min_count is None:
        return True
    return products_count >= min_count


# ============================================================
# Métriques : Budget
# ============================================================

def eval_budget(response: dict, expected: dict) -> tuple[bool, float, float, int]:
    """
    Récupère le suggest_pc_build dans les tool_calls et vérifie :
    - total <= max_budget_mga
    - slots_filled >= min_slots_filled
    Retourne (respected, total, max_budget, slots_filled).
    """
    tool_calls = response.get("tool_calls") or []
    build_result: Optional[dict] = None
    for tc in tool_calls:
        if tc.get("name") == "suggest_pc_build":
            res = tc.get("result")
            if isinstance(res, dict):
                build_result = res
                break

    if build_result is None:
        # Pas de suggest_pc_build appelé → échec
        return False, 0.0, float(expected.get("max_budget_mga", 0)), 0

    total = float(build_result.get("estimated_total") or 0)
    max_budget = float(expected.get("max_budget_mga") or 0)
    slots_filled = int(build_result.get("slots_filled") or 0)

    budget_respected = total <= max_budget if max_budget > 0 else True

    # Vérif slots
    min_slots = expected.get("min_slots_filled", 0)
    slots_ok = slots_filled >= min_slots

    return (budget_respected and slots_ok), total, max_budget, slots_filled


# ============================================================
# Métriques : Guardrails
# ============================================================

REFUSAL_MARKERS = [
    "je ne peux pas", "je ne suis pas", "desole", "je suis uniquement",
    "je ne suis pas en mesure", "hors de mon domaine", "pas dans mon domaine",
    "je suis l'assistant", "specialise", "specialisee", "je ne propose",
    "je ne fournis pas", "je ne traite pas", "mon role est", "je suis concu",
    "je ne peux pas t'aider", "je ne peux pas vous aider",
    "je ne suis pas autorise", "pas autorise", "non autorise",
    "je suis la pour", "je suis uniquement la pour",
    "je suis specialise dans", "je suis specialisee dans",
]


def eval_guardrail(response: dict, expected: dict) -> tuple[bool, bool, bool]:
    """
    Vérifie :
    - refused : la réponse contient un marqueur de refus OU ne contient PAS les mots interdits
    - no_hallucination : la réponse ne contient AUCUN des mots interdits (response_not_contains_any)
    - length_ok : longueur <= max_response_length
    Retourne (refused, no_hallucination, length_ok).
    """
    reply = response.get("reply", "") or ""
    norm = _normalize(reply)

    # Refus
    refused = any(_normalize(m) in norm for m in REFUSAL_MARKERS)

    # Mots interdits
    forbidden = expected.get("response_not_contains_any", [])
    no_hallucination = not _contains_any(reply, forbidden)

    # Longueur
    max_len = expected.get("max_response_length")
    length_ok = (max_len is None) or (len(reply) <= max_len)

    # Si must_refuse et PAS de marqueur explicite → considéré comme non-refusé
    if expected.get("must_refuse") or expected.get("must_refuse_or_redirect"):
        if not refused and not no_hallucination:
            refused = False  # mauvaise réponse ET pas de refus
        elif not refused and no_hallucination:
            # Pas de marqueur explicite mais aucun mot interdit → on tolère
            refused = True

    return refused, no_hallucination, length_ok


def eval_guardrail_must_not_hallucinate(response: dict, expected: dict) -> bool:
    """Version allégée pour 'must_not_hallucinate'."""
    if not expected.get("must_not_hallucinate"):
        return True
    forbidden = expected.get("response_not_contains_any", [])
    reply = response.get("reply", "") or ""
    return not _contains_any(reply, forbidden)


# ============================================================
# Score global par catégorie
# ============================================================

def compute_score(result: QuestionResult) -> float:
    """
    Calcule un score 0..1 pour une question selon sa catégorie.
    Pondérations :
    - RAG : 40% source_hit + 40% content_match + 20% mode
    - FC  : 50% tool_match + 30% args_match + 20% products_ok
    - BUDGET : 50% budget_respected + 30% slots + 20% mode
    - GUARDRAIL : 60% no_hallucination + 40% refused
    """
    cat = result.category

    if cat == "rag":
        return round(
            0.4 * float(result.rag_source_hit)
            + 0.4 * float(result.rag_content_match)
            + 0.2 * float(result.mode_match),
            4,
        )
    if cat == "function_calling":
        return round(
            0.5 * float(result.fc_tool_match)
            + 0.3 * float(result.fc_args_match)
            + 0.2 * float(result.fc_products_count > 0),
            4,
        )
    if cat == "budget":
        slots_ratio = 0.0
        # slots_filled / min_slots_filled (normalisé)
        # On stocke min_slots dans budget_max_mga ? Non → on utilise un flag
        # Simplification : on met 1.0 si slots_filled > 0
        slots_ratio = 1.0 if result.budget_slots_filled > 0 else 0.0
        return round(
            0.5 * float(result.budget_respected)
            + 0.3 * slots_ratio
            + 0.2 * float(result.mode_match),
            4,
        )
    if cat == "guardrail":
        return round(
            0.6 * float(result.guardrail_no_hallucination)
            + 0.4 * float(result.guardrail_refused),
            4,
        )

    # Fallback : moyenne simple
    return round(
        (
            float(result.mode_match)
            + float(result.latency_ok)
        ) / 2,
        4,
    )


# ============================================================
# Statistiques globales
# ============================================================

def percentile(values: list[float], p: float) -> float:
    """Calcule le percentile p (0..100) d'une liste de valeurs."""
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_v) - 1)
    if f == c:
        return float(sorted_v[f])
    return float(sorted_v[f] + (sorted_v[c] - sorted_v[f]) * (k - f))


def aggregate_stats(results: list[QuestionResult]) -> dict[str, Any]:
    """Agrège les métriques sur toutes les questions (global + par catégorie)."""
    if not results:
        return {"total": 0}

    latencies = [r.latency_ms for r in results]
    scores = [r.score for r in results]

    def stats_for(subset: list[QuestionResult]) -> dict[str, Any]:
        if not subset:
            return {"count": 0}
        return {
            "count": len(subset),
            "score_mean": round(statistics.mean([r.score for r in subset]), 4),
            "score_min": round(min(r.score for r in subset), 4),
            "score_max": round(max(r.score for r in subset), 4),
            "latency_p50": int(percentile([r.latency_ms for r in subset], 50)),
            "latency_p95": int(percentile([r.latency_ms for r in subset], 95)),
            "latency_p99": int(percentile([r.latency_ms for r in subset], 99)),
        }

    by_cat: dict[str, list[QuestionResult]] = {}
    for r in results:
        by_cat.setdefault(r.category, []).append(r)

    # Compteurs pass/fail par catégorie
    def pass_rate(subset: list[QuestionResult], threshold: float = 0.75) -> float:
        if not subset:
            return 0.0
        passed = sum(1 for r in subset if r.score >= threshold)
        return round(passed / len(subset), 4)

    cat_summary = {}
    for cat, subset in by_cat.items():
        s = stats_for(subset)
        s["pass_rate"] = pass_rate(subset)
        cat_summary[cat] = s

    return {
        "total": len(results),
        "score_mean": round(statistics.mean(scores), 4),
        "score_median": round(statistics.median(scores), 4),
        "score_min": round(min(scores), 4),
        "score_max": round(max(scores), 4),
        "pass_rate": pass_rate(results),
        "latency_p50": int(percentile(latencies, 50)),
        "latency_p95": int(percentile(latencies, 95)),
        "latency_p99": int(percentile(latencies, 99)),
        "by_category": cat_summary,
    }


# ============================================================
# Évaluation d'une réponse (fonction principale)
# ============================================================

def evaluate_response(
    golden_q: dict,
    response: dict,
    latency_ms: int,
    http_status: int,
) -> QuestionResult:
    """
    Évalue UNE réponse de l'IA contre UNE question du golden set.
    Retourne un QuestionResult rempli.
    """
    expected = golden_q.get("expected", {})
    category = golden_q.get("category", "unknown")

    r = QuestionResult(
        question_id=golden_q.get("id", "?"),
        category=category,
        theme=golden_q.get("theme", ""),
        question=golden_q.get("question", ""),
        mode_expected=golden_q.get("mode", "auto"),
        mode_actual=response.get("mode", "unknown"),
        latency_ms=latency_ms,
        http_status=http_status,
        raw_response=response,
    )

    # Mode + latence (toujours)
    r.mode_match = eval_mode(r.mode_expected, r.mode_actual)
    r.latency_ok = eval_latency(latency_ms, expected.get("max_latency_ms"))

    # Métriques par catégorie
    if category == "rag":
        hit, count, best = eval_rag_sources(response, expected)
        r.rag_source_hit = hit
        r.rag_sources_count = count
        r.rag_best_score = round(best, 4)
        r.rag_content_match = eval_rag_content(response, expected)

    elif category == "function_calling":
        tool_ok, args_ok, prod_count = eval_fc_tool(response, expected)
        r.fc_tool_match = tool_ok
        r.fc_args_match = args_ok
        r.fc_products_count = prod_count
        if not eval_fc_products(prod_count, expected):
            r.errors.append(f"products_count {prod_count} < min")

    elif category == "budget":
        respected, total, max_b, slots = eval_budget(response, expected)
        r.budget_respected = respected
        r.budget_total_mga = total
        r.budget_max_mga = max_b
        r.budget_slots_filled = slots

    elif category == "guardrail":
        refused, no_hallu, len_ok = eval_guardrail(response, expected)
        r.guardrail_refused = refused
        r.guardrail_no_hallucination = no_hallu
        r.guardrail_length_ok = len_ok

    # Score global
    r.score = compute_score(r)
    return r


# ============================================================
# CLI rapide (debug)
# ============================================================

if __name__ == "__main__":
    # Test rapide : normalisation
    assert _normalize("Écran Bleu") == "ecran bleu"
    assert _normalize("2 300 000 Ar") == "2 300 000 ar"
    assert _contains_any("Bonjour, j'ai un écran bleu", ["ecran bleu", "bsod"])
    assert not _contains_any("Bonjour", ["recette", "chocolat"])
    assert _extract_amounts_mga("2 300 000 Ar") == [2300000.0]
    assert _extract_amounts_mga("3 millions") == [3000000.0]

    # Test score
    r = QuestionResult(
        question_id="TEST",
        category="rag",
        theme="test",
        question="?",
        mode_expected="support",
        mode_actual="support",
        latency_ms=1000,
        http_status=200,
        raw_response={},
    )
    r.mode_match = True
    r.rag_source_hit = True
    r.rag_content_match = True
    assert compute_score(r) == 1.0

    print(" metrics.py : tous les tests passent.")