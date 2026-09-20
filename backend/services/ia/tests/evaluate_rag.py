"""
Script d'évaluation du pipeline RAG.
Calcule : Precision@k, Recall@k, MRR, NDCG, latence.

Usage:
    python -m tests.evaluate_rag
    python -m tests.evaluate_rag --top-k 5 --output reports/
"""

import argparse
import asyncio
import json
import math
import time
from pathlib import Path
from typing import Any

from app.rag.pipeline import get_rag_pipeline


async def load_dataset(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("questions", [])


def precision_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    """Proportion de documents pertinents parmi les k premiers."""
    if k == 0:
        return 0.0
    top_k = retrieved[:k]
    if not top_k:
        return 0.0
    relevant = sum(1 for t in top_k if t in expected)
    return relevant / len(top_k)


def recall_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    """Proportion de documents pertinents retrouvés parmi les k premiers."""
    if not expected:
        return 0.0
    top_k = retrieved[:k]
    relevant = sum(1 for t in top_k if t in expected)
    return relevant / len(expected)


def reciprocal_rank(retrieved: list[str], expected: set[str]) -> float:
    """1 / rang du premier document pertinent."""
    for i, title in enumerate(retrieved, 1):
        if title in expected:
            return 1.0 / i
    return 0.0


def dcg_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    """Discounted Cumulative Gain."""
    dcg = 0.0
    for i, title in enumerate(retrieved[:k], 1):
        rel = 1.0 if title in expected else 0.0
        dcg += rel / math.log2(i + 1)
    return dcg


def ndcg_at_k(retrieved: list[str], expected: set[str], k: int) -> float:
    """Normalized DCG."""
    ideal_dcg = sum(1.0 / math.log2(i + 1) for i in range(1, min(len(expected), k) + 1))
    if ideal_dcg == 0:
        return 0.0
    return dcg_at_k(retrieved, expected, k) / ideal_dcg


async def evaluate(top_k: int = 5, dataset_path: str = "tests/rag_eval_dataset.json") -> dict:
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset introuvable: {path}")

    questions = await load_dataset(path)
    print(f"[eval] {len(questions)} questions chargées depuis {path}")

    pipeline = await get_rag_pipeline()
    print(f"[eval] backend embeddings: {pipeline.store.embeddings.backend}")
    print(f"[eval] dimension: {pipeline.store.embeddings.dimension}")
    print(f"[eval] documents en base: {await pipeline.store.count()}")
    print()

    results: list[dict[str, Any]] = []
    latencies: list[float] = []

    for i, q in enumerate(questions, 1):
        query = q["query"]
        expected = set(q["expected_doc_titles"])

        start = time.perf_counter()
        sources = await pipeline.retrieve(query, top_k=top_k)
        latency_ms = (time.perf_counter() - start) * 1000
        latencies.append(latency_ms)

        retrieved_titles = [s.title for s in sources]
        scores = [s.score for s in sources]

        p_at_k = precision_at_k(retrieved_titles, expected, top_k)
        r_at_k = recall_at_k(retrieved_titles, expected, top_k)
        mrr = reciprocal_rank(retrieved_titles, expected)
        ndcg = ndcg_at_k(retrieved_titles, expected, top_k)

        results.append({
            "id": q["id"],
            "query": query,
            "expected": list(expected),
            "retrieved": retrieved_titles,
            "scores": [round(s, 4) for s in scores],
            "precision_at_k": round(p_at_k, 4),
            "recall_at_k": round(r_at_k, 4),
            "rr": round(mrr, 4),
            "ndcg_at_k": round(ndcg, 4),
            "latency_ms": round(latency_ms, 2),
            "hit": len(set(retrieved_titles) & expected) > 0,
        })

        status = "✅" if results[-1]["hit"] else "❌"
        print(f"[{i:02d}/{len(questions)}] {status} P@{top_k}={p_at_k:.2f} R@{top_k}={r_at_k:.2f} "
              f"MRR={mrr:.2f} NDCG={ndcg:.2f} ({latency_ms:.0f}ms)")
        if not results[-1]["hit"]:
            print(f"      query: {query[:80]}")
            print(f"      attendu: {list(expected)[:2]}")
            print(f"      obtenu : {retrieved_titles[:2]}")

    # Agrégation
    n = len(results)
    summary = {
        "num_questions": n,
        "top_k": top_k,
        "backend": pipeline.store.embeddings.backend,
        "dimension": pipeline.store.embeddings.dimension,
        "documents_count": await pipeline.store.count(),
        "metrics": {
            "precision_at_k": sum(r["precision_at_k"] for r in results) / n,
            "recall_at_k": sum(r["recall_at_k"] for r in results) / n,
            "mrr": sum(r["rr"] for r in results) / n,
            "ndcg_at_k": sum(r["ndcg_at_k"] for r in results) / n,
            "hit_rate": sum(1 for r in results if r["hit"]) / n,
            "latency_ms_mean": sum(latencies) / n,
            "latency_ms_p50": sorted(latencies)[n // 2],
            "latency_ms_p95": sorted(latencies)[int(n * 0.95)],
        },
        "by_category": {},
        "results": results,
    }

    # Stats par catégorie
    categories: dict[str, list] = {}
    for r, q in zip(results, questions):
        cat = q.get("category", "unknown")
        categories.setdefault(cat, []).append(r)

    for cat, items in categories.items():
        k = len(items)
        summary["by_category"][cat] = {
            "count": k,
            "precision_at_k": sum(i["precision_at_k"] for i in items) / k,
            "recall_at_k": sum(i["recall_at_k"] for i in items) / k,
            "mrr": sum(i["rr"] for i in items) / k,
            "ndcg_at_k": sum(i["ndcg_at_k"] for i in items) / k,
            "hit_rate": sum(1 for i in items if i["hit"]) / k,
        }

    return summary


def print_summary(s: dict) -> None:
    print("\n" + "=" * 70)
    print(f"  RÉSULTATS D'ÉVALUATION RAG — {s['num_questions']} questions")
    print("=" * 70)
    print(f"  Backend embeddings : {s['backend']} (dim={s['dimension']})")
    print(f"  Documents en base  : {s['documents_count']}")
    print(f"  Top-K              : {s['top_k']}")
    print("-" * 70)
    m = s["metrics"]
    print(f"  Precision@{s['top_k']}       : {m['precision_at_k']:.4f}")
    print(f"  Recall@{s['top_k']}          : {m['recall_at_k']:.4f}")
    print(f"  MRR                : {m['mrr']:.4f}")
    print(f"  NDCG@{s['top_k']}            : {m['ndcg_at_k']:.4f}")
    print(f"  Hit Rate           : {m['hit_rate']:.4f}")
    print(f"  Latence moyenne    : {m['latency_ms_mean']:.2f} ms")
    print(f"  Latence p50        : {m['latency_ms_p50']:.2f} ms")
    print(f"  Latence p95        : {m['latency_ms_p95']:.2f} ms")
    print("-" * 70)
    print("  Par catégorie :")
    for cat, stats in s["by_category"].items():
        print(f"    {cat:20s} n={stats['count']:2d}  P={stats['precision_at_k']:.2f}  "
              f"R={stats['recall_at_k']:.2f}  MRR={stats['mrr']:.2f}  NDCG={stats['ndcg_at_k']:.2f}")
    print("=" * 70)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Évaluation RAG L'AMI")
    parser.add_argument("--top-k", type=int, default=5, help="Nombre de résultats à évaluer")
    parser.add_argument("--dataset", type=str, default="tests/rag_eval_dataset.json")
    parser.add_argument("--output", type=str, default="reports", help="Dossier de sortie")
    args = parser.parse_args()

    summary = await evaluate(top_k=args.top_k, dataset_path=args.dataset)
    print_summary(summary)

    # Sauvegarde JSON
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_file = out_dir / f"rag_evaluation_{ts}.json"
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\n[eval] Résultats sauvegardés: {out_file}")


if __name__ == "__main__":
    asyncio.run(main())