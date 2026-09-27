"""Tests unitaires pour la catégorie Function Calling."""

import pytest

from tests.eval.metrics import evaluate_response, eval_fc_tool, eval_fc_products


def _make_fc_q(qid: str, expected: dict) -> dict:
    return {
        "id": qid,
        "category": "function_calling",
        "theme": "search",
        "question": "test",
        "mode": "commerce",
        "expected": expected,
    }


def test_fc_tool_match_search_products():
    q = _make_fc_q("FC-TEST", {"tool_calls": [{"name": "search_products"}]})
    resp = {
        "mode": "commerce",
        "reply": "Voici des produits",
        "tool_calls": [
            {"name": "search_products", "arguments": {"category": "CPU"}, "result": {}}
        ],
        "products": [{"id": "1"}],
    }
    tool_ok, args_ok, prods = eval_fc_tool(resp, q["expected"])
    assert tool_ok is True
    assert prods == 1


def test_fc_tool_no_match():
    q = _make_fc_q("FC-TEST", {"tool_calls": [{"name": "search_products"}]})
    resp = {
        "mode": "commerce",
        "reply": "Réponse",
        "tool_calls": [{"name": "list_categories", "arguments": {}, "result": {}}],
    }
    tool_ok, _, _ = eval_fc_tool(resp, q["expected"])
    assert tool_ok is False


def test_fc_args_contain():
    q = _make_fc_q("FC-TEST", {
        "tool_calls": [
            {"name": "search_products", "arguments_contain": {"category": "Stockage"}}
        ]
    })
    resp = {
        "tool_calls": [
            {
                "name": "search_products",
                "arguments": {"category": "Stockage", "limit": 10},
                "result": {},
            }
        ]
    }
    _, args_ok, _ = eval_fc_tool(resp, q["expected"])
    assert args_ok is True


def test_fc_products_count_min():
    q = {"products_count_min": 3}
    assert eval_fc_products(5, q) is True
    assert eval_fc_products(1, q) is False


def test_evaluate_response_fc_full():
    q = _make_fc_q("FC-001", {
        "tool_calls": [{"name": "search_products"}],
        "products_count_min": 1,
    })
    resp = {
        "mode": "commerce",
        "reply": "Voici 5 produits",
        "tool_calls": [
            {"name": "search_products", "arguments": {"search": "SSD"}, "result": {}}
        ],
        "products": [{"id": "1"}, {"id": "2"}],
    }
    r = evaluate_response(q, resp, latency_ms=100, http_status=200)
    assert r.fc_tool_match is True
    assert r.fc_products_count == 2
    assert r.score == 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])