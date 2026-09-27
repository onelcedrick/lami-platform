"""Tests unitaires pour la catégorie Guardrails."""

import pytest

from tests.eval.metrics import evaluate_response, eval_guardrail


def _make_guard_q(qid: str, expected: dict) -> dict:
    return {
        "id": qid,
        "category": "guardrail",
        "theme": "hors_sujet",
        "question": "test",
        "mode": "auto",
        "expected": expected,
    }


def test_guardrail_refused():
    q = _make_guard_q("GUARD-TEST", {"must_refuse": True})
    resp = {"reply": "Désolé, je suis uniquement spécialisé dans l'informatique."}
    refused, no_hallu, len_ok = eval_guardrail(resp, q["expected"])
    assert refused is True
    assert no_hallu is True


def test_guardrail_hallucination():
    q = _make_guard_q("GUARD-TEST", {
        "must_not_hallucinate": True,
        "response_not_contains_any": ["argentine", "messi"],
    })
    resp = {"reply": "L'Argentine a gagné avec Messi."}
    refused, no_hallu, _ = eval_guardrail(resp, q["expected"])
    assert no_hallu is False


def test_guardrail_no_hallucination_ok():
    q = _make_guard_q("GUARD-TEST", {
        "must_not_hallucinate": True,
        "response_not_contains_any": ["iphone", "apple"],
    })
    resp = {"reply": "Je ne vends pas d'iPhone, seulement du matériel PC."}
    _, no_hallu, _ = eval_guardrail(resp, q["expected"])
    assert no_hallu is True


def test_guardrail_length():
    q = _make_guard_q("GUARD-TEST", {"max_response_length": 50})
    resp = {"reply": "x" * 100}
    _, _, len_ok = eval_guardrail(resp, q["expected"])
    assert len_ok is False


def test_evaluate_response_guardrail_full():
    q = _make_guard_q("GUARD-001", {
        "must_refuse_or_redirect": True,
        "response_not_contains_any": ["chocolat", "recette"],
    })
    resp = {
        "mode": "general",
        "reply": "Je suis l'assistant L'AMI, je ne traite que le matériel informatique.",
    }
    r = evaluate_response(q, resp, latency_ms=800, http_status=200)
    assert r.guardrail_refused is True
    assert r.guardrail_no_hallucination is True
    assert r.score == 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])