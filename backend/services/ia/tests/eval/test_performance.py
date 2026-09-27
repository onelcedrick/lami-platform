"""Tests de performance (latence, taux d'erreur)."""

import pytest

from tests.eval.metrics import percentile, aggregate_stats, QuestionResult


def test_percentile_empty():
    assert percentile([], 50) == 0.0


def test_percentile_single():
    assert percentile([100], 50) == 100


def test_percentile_p50():
    assert percentile([10, 20, 30, 40, 50], 50) == 30


def test_percentile_p95():
    vals = list(range(1, 101))  # 1..100
    assert 94 <= percentile(vals, 95) <= 96


def test_aggregate_stats_basic():
    results = [
        QuestionResult(
            question_id=f"Q{i}",
            category="rag",
            theme="t",
            question="?",
            mode_expected="support",
            mode_actual="support",
            latency_ms=100 * i,
            http_status=200,
            raw_response={},
            score=0.5 + 0.1 * i,
        )
        for i in range(1, 6)
    ]
    stats = aggregate_stats(results)
    assert stats["total"] == 5
    assert 0.5 <= stats["score_mean"] <= 1.0
    assert stats["latency_p50"] == 300
    assert "rag" in stats["by_category"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])