#!/usr/bin/env python3
"""
Moteur d'évaluation du Golden Set L'AMI.

Usage :
    python -m tests.eval.run_eval                    # toutes les questions
    python -m tests.eval.run_eval --category rag    # 1 seule catégorie
    python -m tests.eval.run_eval --limit 10        # 10 premières
    python -m tests.eval.run_eval --base-url http://localhost:8090

Sortie :
    - tests/eval/reports/eval_YYYYMMDD_HHMMSS.json  (résultats bruts)
    - tests/eval/reports/eval_YYYYMMDD_HHMMSS.md    (rapport lisible)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Ajoute le parent au path pour les imports
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from tests.eval.eval_runner import EvalRunner
from tests.eval.metrics import (
    QuestionResult,
    aggregate_stats,
    evaluate_response,
)

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"
REPORTS_DIR = Path(__file__).parent / "reports"


# ============================================================
# Chargement du golden set
# ============================================================

def load_golden_set() -> list[dict]:
    """Charge le golden set et filtre les entrées non-dict (commentaires)."""
    with open(GOLDEN_SET_PATH, encoding="utf-8") as f:
        data = json.load(f)
    questions = data.get("questions", [])
    # Filtre les chaînes (commentaires de séparation)
    return [q for q in questions if isinstance(q, dict)]


# ============================================================
# Exécution
# ============================================================

async def evaluate_one(runner: EvalRunner, q: dict) -> QuestionResult:
    """Évalue une question et retourne le QuestionResult."""
    response, latency, status = await runner.chat(
        message=q["question"],
        mode=q.get("mode", "auto"),
    )
    return evaluate_response(q, response, latency, status)


async def run_all(
    questions: list[dict],
    base_url: str,
    delay_between: float = 0.5,
) -> list[QuestionResult]:
    """Exécute l'évaluation de toutes les questions en série."""
    results: list[QuestionResult] = []
    total = len(questions)

    async with EvalRunner(base_url=base_url) as runner:
        # Vérifie le health
        health = await runner.health()
        print(f"\n🏥 Health check: {health}\n")

        for i, q in enumerate(questions, 1):
            qid = q.get("id", "?")
            cat = q.get("category", "?")
            print(f"[{i:3d}/{total}] {qid} ({cat}) ", end="", flush=True)

            result = await evaluate_one(runner, q)
            results.append(result)

            status_emoji = "✅" if result.score >= 0.75 else "⚠️" if result.score >= 0.4 else "❌"
            print(
                f"{status_emoji} score={result.score:.2f} "
                f"({result.latency_ms} ms, mode={result.mode_actual})"
            )

            # Petite pause pour ne pas saturer le service
            if delay_between > 0 and i < total:
                await asyncio.sleep(delay_between)

    return results


# ============================================================
# Rapport JSON
# ============================================================

def build_json_report(results: list[QuestionResult], base_url: str) -> dict:
    stats = aggregate_stats(results)
    return {
        "generated_at": datetime.now().isoformat(),
        "base_url": base_url,
        "total_questions": len(results),
        "global_stats": stats,
        "results": [r.to_dict() for r in results],
    }


# ============================================================
# Rapport Markdown
# ============================================================

def _emoji_score(score: float) -> str:
    if score >= 0.9:
        return "🟢"
    if score >= 0.75:
        return "🟡"
    if score >= 0.4:
        return "🟠"
    return "🔴"


def build_md_report(report: dict) -> str:
    g = report["global_stats"]
    lines: list[str] = []

    lines.append(f"# 📊 Rapport d'évaluation — L'AMI Assistant IA\n")
    lines.append(f"**Date** : {report['generated_at']}  ")
    lines.append(f"**Endpoint** : `{report['base_url']}`  ")
    lines.append(f"**Questions** : {report['total_questions']}\n")

    # ====== Synthèse globale ======
    lines.append("## 🎯 Synthèse globale\n")
    lines.append(f"| Métrique | Valeur |")
    lines.append(f"|---|---|")
    lines.append(f"| Score moyen | **{g['score_mean']:.3f}** |")
    lines.append(f"| Score médian | {g['score_median']:.3f} |")
    lines.append(f"| Score min / max | {g['score_min']:.3f} / {g['score_max']:.3f} |")
    lines.append(f"| Taux de réussite (≥0.75) | **{g['pass_rate']*100:.1f}%** |")
    lines.append(f"| Latence p50 | {g['latency_p50']} ms |")
    lines.append(f"| Latence p95 | {g['latency_p95']} ms |")
    lines.append(f"| Latence p99 | {g['latency_p99']} ms |\n")

    # ====== Par catégorie ======
    lines.append("## 📂 Résultats par catégorie\n")
    lines.append("| Catégorie | N | Score moyen | Pass rate | p50 (ms) | p95 (ms) |")
    lines.append("|---|---|---|---|---|---|")
    for cat, s in sorted(g["by_category"].items()):
        lines.append(
            f"| {cat} | {s['count']} | {s['score_mean']:.3f} | "
            f"{s['pass_rate']*100:.1f}% | {s['latency_p50']} | {s['latency_p95']} |"
        )
    lines.append("")

    # ====== Détail par question ======
    lines.append("## 📝 Détail par question\n")
    for cat in sorted({r["category"] for r in report["results"]}):
        subset = [r for r in report["results"] if r["category"] == cat]
        if not subset:
            continue
        lines.append(f"### Catégorie : `{cat}` ({len(subset)} questions)\n")
        lines.append("| ID | Theme | Score | Latence | Détails |")
        lines.append("|---|---|---|---|---|")
        for r in subset:
            emoji = _emoji_score(r["score"])
            details = _build_details(r)
            lines.append(
                f"| {r['question_id']} | {r['theme']} | {emoji} {r['score']:.2f} | "
                f"{r['latency_ms']} ms | {details} |"
            )
        lines.append("")

    # ====== Erreurs ======
    failed = [r for r in report["results"] if r["score"] < 0.5]
    if failed:
        lines.append("## ❌ Questions échouées (score < 0.5)\n")
        for r in failed:
            lines.append(f"### `{r['question_id']}` — {r['question']}")
            lines.append(f"- **Score** : {r['score']:.2f}")
            lines.append(f"- **Mode attendu** : `{r['mode_expected']}` / **réel** : `{r['mode_actual']}`")
            lines.append(f"- **Réponse brute** :")
            reply = (r["raw_response"].get("reply") or "")[:400]
            lines.append(f"  > {reply}\n")
            if r["errors"]:
                lines.append(f"- **Erreurs** : {r['errors']}")
            lines.append("")

    # ====== Conclusion ======
    lines.append("## ✅ Conclusion\n")
    lines.append(f"- **Score global** : {g['score_mean']:.3f} / 1.0")
    lines.append(f"- **Pass rate** : {g['pass_rate']*100:.1f}%")
    lines.append(f"- **Latence médiane** : {g['latency_p50']} ms")
    lines.append("")
    if g["score_mean"] >= 0.8:
        lines.append("🟢 **Système performant** — prêt pour la production.")
    elif g["score_mean"] >= 0.6:
        lines.append("🟡 **Système correct** — des améliorations sont possibles.")
    else:
        lines.append("🔴 **Système à améliorer** — revoir l'orchestrateur et/ou le RAG.")

    return "\n".join(lines)


def _build_details(r: dict) -> str:
    """Construit une chaîne courte avec les métriques clés."""
    cat = r["category"]
    if cat == "rag":
        return (
            f"src_hit={r['rag_source_hit']}, "
            f"content={r['rag_content_match']}, "
            f"n_src={r['rag_sources_count']}"
        )
    if cat == "function_calling":
        return (
            f"tool={r['fc_tool_match']}, "
            f"args={r['fc_args_match']}, "
            f"prods={r['fc_products_count']}"
        )
    if cat == "budget":
        return (
            f"budget_ok={r['budget_respected']}, "
            f"slots={r['budget_slots_filled']}, "
            f"total={r['budget_total_mga']:.0f}/{r['budget_max_mga']:.0f}"
        )
    if cat == "guardrail":
        return (
            f"refused={r['guardrail_refused']}, "
            f"no_hallu={r['guardrail_no_hallucination']}"
        )
    return ""


# ============================================================
# CLI
# ============================================================

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Évaluation du Golden Set L'AMI")
    p.add_argument("--category", "-c", default=None, help="Filtrer par catégorie")
    p.add_argument("--limit", "-l", type=int, default=None, help="Limiter le nombre")
    p.add_argument("--base-url", default="http://localhost:8090", help="URL du service IA")
    p.add_argument("--delay", type=float, default=0.5, help="Pause entre questions (s)")
    p.add_argument("--no-report", action="store_true", help="Ne pas écrire de rapport")
    return p.parse_args()


async def main() -> int:
    args = parse_args()

    print("╔══════════════════════════════════════════════╗")
    print("║   📊 ÉVALUATION GOLDEN SET — L'AMI IA       ║")
    print("╚══════════════════════════════════════════════╝")

    questions = load_golden_set()
    print(f"\n📂 Golden Set : {len(questions)} questions chargées")

    if args.category:
        questions = [q for q in questions if q.get("category") == args.category]
        print(f"🎯 Filtre : catégorie = {args.category} → {len(questions)} questions")

    if args.limit:
        questions = questions[: args.limit]
        print(f"🔢 Limite : {len(questions)} questions")

    if not questions:
        print("❌ Aucune question à évaluer.")
        return 1

    print(f"\n🚀 Démarrage de l'évaluation ({len(questions)} questions)...\n")

    results = await run_all(questions, args.base_url, args.delay)

    # ====== Rapport ======
    report = build_json_report(results, args.base_url)

    print("\n" + "=" * 60)
    print("📊 RÉSULTATS GLOBAUX")
    print("=" * 60)
    g = report["global_stats"]
    print(f"  Score moyen      : {g['score_mean']:.3f}")
    print(f"  Score médian     : {g['score_median']:.3f}")
    print(f"  Pass rate (≥0.75): {g['pass_rate']*100:.1f}%")
    print(f"  Latence p50/p95  : {g['latency_p50']} / {g['latency_p95']} ms")
    print()
    print("  Par catégorie :")
    for cat, s in sorted(g["by_category"].items()):
        print(
            f"    - {cat:20s} : score={s['score_mean']:.3f} "
            f"pass={s['pass_rate']*100:5.1f}% (n={s['count']})"
        )

    if not args.no_report:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = REPORTS_DIR / f"eval_{ts}.json"
        md_path = REPORTS_DIR / f"eval_{ts}.md"

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(build_md_report(report))

        print(f"\n💾 Rapport JSON  : {json_path}")
        print(f"💾 Rapport MD    : {md_path}")

    # Code de retour
    return 0 if g["pass_rate"] >= 0.7 else 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))