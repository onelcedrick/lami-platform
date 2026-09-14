"""Tests construction prompts RAG."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.models import SourceDocument
from app.rag.pipeline import RAGPipeline


class FakeStore:
    pass


def test_build_context_empty():
    rag = RAGPipeline(FakeStore())  # type: ignore
    assert rag.build_context([]) == ""


def test_build_context_with_sources():
    rag = RAGPipeline(FakeStore())  # type: ignore
    sources = [
        SourceDocument(id="1", title="BSOD", content="Diagnostic ecran bleu", score=0.9),
        SourceDocument(id="2", title="PSU", content="Checklist alimentation", score=0.7),
    ]
    ctx = rag.build_context(sources)
    assert "BSOD" in ctx
    assert "PSU" in ctx
    assert "[1]" in ctx


def test_support_prompt_with_context():
    rag = RAGPipeline(FakeStore())  # type: ignore
    prompt = rag.build_support_prompt("ecran bleu", "contexte test")
    assert "ecran bleu" in prompt
    assert "contexte test" in prompt
    assert "L'AMI" in prompt or "L'AMI" in prompt.replace("'", "'")


def test_support_prompt_without_context():
    rag = RAGPipeline(FakeStore())  # type: ignore
    prompt = rag.build_support_prompt("probleme inconnu", "")
    assert "ticket" in prompt.lower() or "documentation" in prompt.lower()
