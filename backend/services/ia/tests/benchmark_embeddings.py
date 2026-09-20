"""
Benchmark comparatif : hash embeddings vs sentence-transformers.

Usage:
    EMBEDDINGS_BACKEND=hash python -m tests.benchmark_embeddings
    EMBEDDINGS_BACKEND=sentence-transformers python -m tests.benchmark_embeddings
"""

import asyncio
import json
import time
from pathlib import Path

from tests.evaluate_rag import evaluate, print_summary


async def run_once(label: str, backend: str) -> dict:
    print(f"\n{'=' * 70}")
    print(f"  BENCHMARK: {label} (EMBEDDINGS_BACKEND={backend})")
    print("=" * 70)

    import os
    os.environ["EMBEDDINGS_BACKEND"] = backend

    # Reset lru_cache pour recharger
    from app.rag.embeddings import get_embedding_service
    get_embedding_service.cache_clear()

    start = time.perf_counter()
    summary = await evaluate(top_k=5)
    duration = time.perf_counter() - start

    summary["benchmark_label"] = label
    summary["benchmark_backend"] = backend
    summary["total_duration_s"] = round(duration, 2)
    return summary


async def main() -> None:
    results = []

    # 1) Hash (baseline rapide)
    try:
        r1 = await run_once("Hash embeddings (baseline)", "hash")
        results.append(r1)
    except Exception as e:
        print(f"[benchmark] Hash failed: {e}")

    # 2) Sentence-transformers (si disponible)
    try:
        r2 = await run_once("Sentence-Transformers MiniLM-L6", "sentence-transformers")
        results.append(r2)
    except Exception as e:
        print(f"[benchmark] ST failed: {e}")

    # Comparaison
    print("\n\n" + "=" * 70)
    print("  COMPARAISON FINALE")
    print("=" * 70)
    print(f"{'Backend':<35} {'P@5':>8} {'R@5':>8} {'MRR':>8} {'NDCG@5':>8} {'Latence':>10}")
    print("-" * 70)
    for r in results:
        m = r["metrics"]
        print(f"{r['benchmark_label']:<35} "
              f"{m['precision_at_k']:>8.4f} "
              f"{m['recall_at_k']:>8.4f} "
              f"{m['mrr']:>8.4f} "
              f"{m['ndcg_at_k']:>8.4f} "
              f"{m['latency_ms_mean']:>8.2f}ms")
    print("=" * 70)

    # Sauvegarde
    out_dir = Path("reports")
    out_dir.mkdir(exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_file = out_dir / f"embedding_benchmark_{ts}.json"
    with out_file.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[benchmark] Résultats: {out_file}")


if __name__ == "__main__":
    asyncio.run(main())