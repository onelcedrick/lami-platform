"""Tests unitaires pour la catégorie Budget-aware."""

import pytest

from tests.eval.metrics import evaluate_response, eval_budget


def _make_budget_q(qid: str, expected: dict) -> dict:
    return {
        "id": qid,
        "category": "budget",
        "theme": "gaming",
        "question": "test",
        "mode": "commerce",
        "expected": expected,
    }


def test_budget_respected():
    q = _make_budget_q("BUDGET-TEST", {
        "max_budget_mga": 3000000,
        "min_slots_filled": 3,
    })
    resp = {
        "mode": "commerce",
        "reply": "Config : ...",
        "tool_calls": [
            {
                "name": "suggest_pc_build",
                "arguments": {"usage": "gaming", "budget": 3000000},
                "result": {
                    "estimated_total": 2_800_000,
                    "slots_filled": 5,
                },
            }
        ],
    }
    ok, total, maxb, slots = eval_budget(resp, q["expected"])
    assert ok is True
    assert total == 2_800_000
    assert slots == 5


def test_budget_exceeded():
    q = _make_budget_q("BUDGET-TEST", {"max_budget_mga": 3000000})
    resp = {
        "tool_calls": [
            {
                "name": "suggest_pc_build",
                "arguments": {},
                "result": {"estimated_total": 3_500_000, "slots_filled": 4},
            }
        ]
    }
    ok, total, _, _ = eval_budget(resp, q["expected"])
    assert ok is False
    assert total == 3_500_000


def test_budget_no_tool_call():
    q = _make_budget_q("BUDGET-TEST", {"max_budget_mga": 3000000})
    resp = {"tool_calls": [], "reply": "Je ne comprends pas"}
    ok, total, _, _ = eval_budget(resp, q["expected"])
    assert ok is False
    assert total == 0


def test_budget_slots_failed():
    q = _make_budget_q("BUDGET-TEST", {
        "max_budget_mga": 5000000,
        "min_slots_filled": 5,
    })
    resp = {
        "tool_calls": [
            {
                "name": "suggest_pc_build",
                "arguments": {},
                "result": {"estimated_total": 2_000_000, "slots_filled": 2},
            }
        ]
    }
    ok, _, _, slots = eval_budget(resp, q["expected"])
    assert ok is False
    assert slots == 2


def test_evaluate_response_budget_full():
    q = _make_budget_q("BUDGET-001", {
        "max_budget_mga": 3000000,
        "min_slots_filled": 3,
    })
    resp = {
        "mode": "commerce",
        "reply": "Voici la config",
        "tool_calls": [
            {
                "name": "suggest_pc_build",
                "arguments": {"usage": "gaming", "budget": 3000000},
                "result": {"estimated_total": 2_500_000, "slots_filled": 4},
            }
        ],
    }
    r = evaluate_response(q, resp, latency_ms=200, http_status=200)
    assert r.budget_respected is True
    assert r.budget_slots_filled == 4
    assert r.score >= 0.9


if __name__ == "__main__":
    pytest.main([__file__, "-v"])