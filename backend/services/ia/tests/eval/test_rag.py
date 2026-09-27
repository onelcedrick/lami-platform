"""
Tests unitaires pour la catégorie RAG.
Ne nécessite PAS le service IA up : teste les fonctions de metrics.py.
"""

import pytest

from tests.eval.metrics import (
    evaluate_response,
    eval_rag_sources,
    eval_rag_content,
)


def _make_rag_q(qid: str, expected: dict) -> dict:
    return {
        "id": qid,
        "category": "rag",
        "theme": "diagnostic",
        "question": "test",
        "mode": "support",
        "expected": expected,
    }


def test_rag_sources_min_count_ok():
    q = _make_rag_q("RAG-TEST", {"min_sources": 1})
    resp = {
        "mode": "support",
        "reply": "Réponse",
        "sources": [{"title": "Doc A", "score": 0.8}],
    }
    hit, count, best = eval_rag_sources(resp, q["expected"])
    assert hit is True
    assert count == 1
    assert best == 0.8


def test_rag_sources_min_count_fail():
    q = _make_rag_q("RAG-TEST", {"min_sources": 2})
    resp = {"sources": [{"title": "Doc A", "score": 0.8}]}
    hit, count, _ = eval_rag_sources(resp, q["expected"])
    assert hit is False
    assert count == 1


def test_rag_source_title_match():
    q = _make_rag_q("RAG-TEST", {
        "min_sources": 1,
        "source_titles_should_include_any": ["SSD NVMe"],
    })
    resp = {
        "sources": [
            {"title": "SSD NVMe non detecte", "score": 0.6},
            {"title": "Autre doc", "score": 0.4},
        ]
    }
    hit, count, _ = eval_rag_sources(resp, q["expected"])
    assert hit is True
    assert count == 2


def test_rag_content_match():
    q = _make_rag_q("RAG-TEST", {
        "response_contains_any": ["M.2", "NVMe", "AHCI"],
    })
    resp = {"reply": "Vérifiez le slot M.2 et activez le mode AHCI."}
    assert eval_rag_content(resp, q["expected"]) is True


def test_rag_content_no_match():
    q = _make_rag_q("RAG-TEST", {
        "response_contains_any": ["M.2", "NVMe"],
    })
    resp = {"reply": "Désolé, je ne peux pas vous aider."}
    assert eval_rag_content(resp, q["expected"]) is False


def test_evaluate_response_rag_full():
    q = _make_rag_q("RAG-001", {
        "min_sources": 1,
        "source_titles_should_include_any": ["BSOD"],
        "response_contains_any": ["RAM", "memoire"],
    })
    resp = {
        "mode": "support",
        "reply": "Testez votre RAM avec Windows Memory Diagnostic.",
        "sources": [{"title": "Ecran bleu (BSOD)", "score": 0.9}],
    }
    r = evaluate_response(q, resp, latency_ms=1500, http_status=200)
    assert r.rag_source_hit is True
    assert r.rag_content_match is True
    assert r.mode_match is True
    assert r.score == 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])