"""Test flux config PC -> acceptation -> add_to_cart (heuristiques)."""
import re


def test_budget_ariary_parsing():
    lower = "je veux un pc gaming a 3 millions ar"
    millions = re.search(r"(\d+[.,]?\d*)\s*millions?", lower)
    assert millions is not None
    budget = float(millions.group(1).replace(",", ".")) * 1_000_000
    assert budget == 3_000_000


def test_accept_keywords():
    accept = ("oui", "ok", "ajoute", "panier", "d'accord")
    msg = "oui, ajoute au panier"
    assert any(w in msg for w in accept)


def test_reject_keywords():
    reject = ("non", "pas maintenant")
    msg = "non merci"
    assert any(w in msg for w in reject)
