"""Tests unitaires du routage Agent (sans dependances lourdes)."""

import sys
from pathlib import Path

# Ajouter le package app au path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agent.orchestrator import AgentOrchestrator, SUPPORT_KEYWORDS, COMMERCE_KEYWORDS


def test_detect_mode_support():
    orch = AgentOrchestrator.__new__(AgentOrchestrator)
    assert orch.detect_mode("Mon PC affiche un ecran bleu BSOD") == "support"
    assert orch.detect_mode("Comment reparer une surchauffe CPU ?") == "support"


def test_detect_mode_commerce():
    orch = AgentOrchestrator.__new__(AgentOrchestrator)
    assert orch.detect_mode("Je cherche une carte graphique pour gaming budget 800 euros") == "commerce"
    assert orch.detect_mode("Quel processeur recommandez-vous ?") == "commerce"


def test_detect_mode_forced():
    orch = AgentOrchestrator.__new__(AgentOrchestrator)
    assert orch.detect_mode("bonjour", forced="support") == "support"
    assert orch.detect_mode("bonjour", forced="commerce") == "commerce"


def test_detect_mode_general():
    orch = AgentOrchestrator.__new__(AgentOrchestrator)
    mode = orch.detect_mode("Bonjour, qui etes-vous ?")
    assert mode == "general"


def test_keywords_non_empty():
    assert len(SUPPORT_KEYWORDS) > 5
    assert len(COMMERCE_KEYWORDS) > 5
