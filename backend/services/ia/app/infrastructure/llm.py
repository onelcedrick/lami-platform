"""Client LLM Groq — modeles a jour, budget de retry borne, disjoncteur.

Correctifs (novembre 2026) :
  1. `llama-3.1-8b-instant` / `llama-3.3-70b-versatile` sont RETIRES depuis le
     16/08/2026 (free + developer) -> HTTP 404 a chaque appel NLU, puis repli
     sur le gros modele. Resolution dynamique via GET /models.
  2. gpt-oss sont des modeles a RAISONNEMENT : sans `reasoning_effort=low`,
     les max_tokens sont consommes par le raisonnement -> `content=""` et
     `finish_reason="length"` -> NLG vide -> fallback systematique.
  3. Les 429 etaient retentes 4 fois avec un backoff de 0.6 s en ignorant
     `Retry-After` : 2 appels x 4 tentatives = jusqu'a 41 s par message.
     Desormais : budget de temps par appel + Retry-After respecte +
     disjoncteur (reponse deterministe immediate quand le quota est epuise).
  4. Les quotas Groq sont PAR MODELE (30 RPM / 8000 TPM en free) : NLU et
     NLG utilisent deux modeles distincts -> quotas independants.
"""
from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from typing import Any, Optional

import httpx

from app.core.config import get_settings
from app.domain.ports import LLMPort

logger = logging.getLogger("ia.llm")

GROQ_URL = "https://api.groq.com/openai/v1"

# Modeles encore servis (novembre 2026), du plus econome au plus lourd.
NLU_PREFS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"]
NLG_PREFS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]

RETIRED = {
    "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama3-8b-8192",
    "llama3-70b-8192", "llama-3.1-70b-versatile", "gemma2-9b-it", "gemma-7b-it",
    "mixtral-8x7b-32768", "mistral-saba-24b", "qwen-qwq-32b", "qwen/qwen3-32b",
    "qwen/qwen3.6-27b", "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "moonshotai/kimi-k2-instruct", "moonshotai/kimi-k2-instruct-0905",
    "deepseek-r1-distill-llama-70b", "groq/compound", "groq/compound-mini",
}

_UNITS = {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}


def parse_delay(value: Any) -> float:
    """Groq renvoie '2', '1.5s', '200ms', '1m30s' -> secondes."""
    if value is None:
        return 0.0
    txt = str(value).strip().lower()
    if not txt:
        return 0.0
    try:
        return max(0.0, float(txt))
    except ValueError:
        pass
    total = 0.0
    for num, unit in re.findall(r"(\d+(?:\.\d+)?)\s*(ms|s|m|h)", txt):
        total += float(num) * _UNITS[unit]
    return total


def is_gpt_oss(model: str) -> bool:
    return model.startswith("openai/gpt-oss") and "safeguard" not in model


class _Quota:
    """Etat de quota + disjoncteur, PAR MODELE."""

    def __init__(self) -> None:
        self.remaining_tokens: Optional[float] = None
        self.tokens_reset: float = 0.0
        self.remaining_requests: Optional[float] = None
        self.requests_reset: float = 0.0
        self.blocked_until: float = 0.0
        self.failures: int = 0
        self.open_until: float = 0.0

    def absorb(self, headers: Any) -> None:
        now = time.monotonic()

        def num(name: str) -> Optional[float]:
            try:
                return float(headers.get(name))
            except (TypeError, ValueError):
                return None

        rt = num("x-ratelimit-remaining-tokens")
        if rt is not None:
            self.remaining_tokens = rt
            self.tokens_reset = now + parse_delay(headers.get("x-ratelimit-reset-tokens"))
        rr = num("x-ratelimit-remaining-requests")
        if rr is not None:
            self.remaining_requests = rr
            self.requests_reset = now + parse_delay(
                headers.get("x-ratelimit-reset-requests")
            )

    def wait_for(self, need_tokens: int) -> float:
        now = time.monotonic()
        wait = max(0.0, self.blocked_until - now)
        if (self.remaining_tokens is not None
                and self.remaining_tokens < need_tokens
                and self.tokens_reset > now):
            wait = max(wait, self.tokens_reset - now)
        if (self.remaining_requests is not None
                and self.remaining_requests < 1
                and self.requests_reset > now):
            wait = max(wait, self.requests_reset - now)
        return wait


_quotas: dict[str, _Quota] = {}
_bad_models: set[str] = set()
_catalog: list[str] = []
_catalog_at: float = 0.0
_catalog_lock = asyncio.Lock()
_client: Optional[httpx.AsyncClient] = None
_client_lock = asyncio.Lock()
_sem: Optional[asyncio.Semaphore] = None
_logged: dict[str, str] = {}


def _quota(model: str) -> _Quota:
    q = _quotas.get(model)
    if q is None:
        q = _Quota()
        _quotas[model] = q
    return q


async def _get_client() -> httpx.AsyncClient:
    global _client, _sem
    settings = get_settings()
    if _sem is None:
        _sem = asyncio.Semaphore(max(1, settings.llm_max_concurrency))
    if _client is None or _client.is_closed:
        async with _client_lock:
            if _client is None or _client.is_closed:
                _client = httpx.AsyncClient(
                    timeout=httpx.Timeout(20.0, connect=5.0),
                    limits=httpx.Limits(max_connections=30,
                                        max_keepalive_connections=15),
                )
    return _client


async def close_llm_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


class LLMClient(LLMPort):
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def provider_name(self) -> str:
        return "groq"

    def _base_url(self) -> str:
        key = self.settings.groq_api_key or self.settings.openai_api_key
        base = (self.settings.openai_base_url or GROQ_URL).rstrip("/")
        if key.startswith("gsk_") and "api.openai.com" in base:
            base = GROQ_URL
        return base

    def _headers(self) -> dict[str, str]:
        key = self.settings.groq_api_key or self.settings.openai_api_key
        return {"Authorization": f"Bearer {key}",
                "Content-Type": "application/json"}

    # ---------------- resolution des modeles ----------------
    async def _refresh_catalog(self, client: httpx.AsyncClient) -> None:
        global _catalog, _catalog_at
        async with _catalog_lock:
            if _catalog and (time.monotonic() - _catalog_at) < 3600:
                return
            try:
                res = await client.get(f"{self._base_url()}/models",
                                       headers=self._headers())
                res.raise_for_status()
                data = res.json().get("data") or []
                ids = [str(m.get("id")) for m in data if isinstance(m, dict)]
                _catalog = [m for m in ids if m and m not in RETIRED]
                _catalog_at = time.monotonic()
                logger.info("Modeles Groq disponibles : %s", ", ".join(_catalog))
            except Exception as exc:
                logger.warning("Liste des modeles indisponible : %s", exc)
                _catalog_at = time.monotonic()

    async def _model_for(self, purpose: str,
                         client: httpx.AsyncClient) -> str:
        override = (self.settings.llm_model_nlu if purpose == "nlu"
                    else self.settings.llm_model_nlg)
        if override and override not in RETIRED and override not in _bad_models:
            return override
        await self._refresh_catalog(client)
        prefs = NLU_PREFS if purpose == "nlu" else NLG_PREFS
        pool = [m for m in prefs if m not in _bad_models]
        if _catalog:
            avail = [m for m in pool if m in _catalog]
            if avail:
                pool = avail
        model = pool[0] if pool else (
            self.settings.groq_model or "openai/gpt-oss-120b")
        if _logged.get(purpose) != model:
            _logged[purpose] = model
            logger.info("Modele %s = %s", purpose.upper(), model)
        return model

    async def _candidates(self, purpose: str, explicit: Optional[str],
                          client: httpx.AsyncClient) -> list[str]:
        first = explicit or await self._model_for(purpose, client)
        prefs = NLU_PREFS if purpose == "nlu" else NLG_PREFS
        order = [first] + [m for m in prefs if m != first]
        if _catalog:
            order = [m for m in order if m in _catalog] or order
        return [m for m in order if m not in _bad_models and m not in RETIRED]

    async def _pick_with_capacity(self, purpose: str, explicit: Optional[str],
                                  client: httpx.AsyncClient, need: int,
                                  deadline: float) -> tuple[str, float]:
        """Choisit un modele qui a encore du quota (quotas PAR modele)."""
        order = await self._candidates(purpose, explicit, client)
        if not order:
            return (explicit or self.settings.groq_model
                    or "openai/gpt-oss-120b"), 0.0
        fallback: Optional[tuple[str, float]] = None
        for m in order:
            q = _quota(m)
            now = time.monotonic()
            if q.open_until > now:
                continue
            wait = q.wait_for(need)
            if now + wait <= deadline - 0.5:
                return m, wait
            if fallback is None:
                fallback = (m, wait)
        return fallback or (order[0], 0.0)

    # ---------------- appel ----------------
    async def generate(
        self,
        prompt: str,
        system: str = "",
        temperature: float = 0.3,
        json_mode: bool = False,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        purpose: str = "nlg",
        budget_s: Optional[float] = None,
    ) -> dict:
        t0 = time.monotonic()
        key = self.settings.groq_api_key or self.settings.openai_api_key
        if not key:
            logger.error("Aucune cle API LLM configuree")
            return {"content": "", "error": "cle API manquante"}

        budget = float(budget_s if budget_s is not None else (
            self.settings.llm_nlu_budget_s if purpose == "nlu"
            else self.settings.llm_nlg_budget_s))
        deadline = t0 + max(1.0, budget)

        client = await _get_client()
        if model and (model in RETIRED or model in _bad_models):
            model = None

        tokens = int(max_tokens or (
            self.settings.nlu_max_tokens if purpose == "nlu"
            else self.settings.nlg_max_tokens))
        est = tokens + len(prompt) // 3 + len(system) // 3
        target, pre_wait = await self._pick_with_capacity(
            purpose, model, client, est, deadline)
        if pre_wait > 0:
            await asyncio.sleep(pre_wait)
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
            "model": target,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if is_gpt_oss(target):
            payload["reasoning_effort"] = self.settings.llm_reasoning_effort
            payload["include_reasoning"] = bool(self.settings.llm_include_reasoning)

        url = f"{self._base_url()}/chat/completions"
        attempts = max(1, int(self.settings.llm_max_attempts))
        last_err = "inconnu"
        grew = False

        for attempt in range(attempts):
            q = _quota(target)
            now = time.monotonic()
            if q.open_until > now:
                return {"content": "", "model": target, "attempts": attempt,
                        "error": "quota LLM epuise (disjoncteur ouvert)",
                        "elapsed_ms": int((time.monotonic() - t0) * 1000)}
            wait = q.wait_for(est)
            if wait > 0:
                if now + wait > deadline - 0.5:
                    q.open_until = max(q.open_until, now + min(wait, 30.0))
                    return {"content": "", "model": target, "attempts": attempt,
                            "error": f"quota local, reset dans {wait:.1f}s",
                            "elapsed_ms": int((time.monotonic() - t0) * 1000)}
                await asyncio.sleep(wait + random.uniform(0.0, 0.15))

            try:
                assert _sem is not None
                async with _sem:
                    res = await client.post(url, headers=self._headers(),
                                            json=payload)
            except Exception as exc:
                last_err = f"{type(exc).__name__}: {exc}"
                logger.warning("LLM %s tentative %s : %s",
                               purpose, attempt + 1, last_err)
                if time.monotonic() + 0.5 > deadline:
                    break
                await asyncio.sleep(min(0.4 * (attempt + 1),
                                        max(0.0, deadline - time.monotonic())))
                continue

            q.absorb(res.headers)
            code = res.status_code

            if code == 429:
                delay = parse_delay(res.headers.get("retry-after")) or max(
                    parse_delay(res.headers.get("x-ratelimit-reset-tokens")),
                    parse_delay(res.headers.get("x-ratelimit-reset-requests")),
                    1.0)
                q.blocked_until = time.monotonic() + delay
                q.failures += 1
                last_err = "HTTP 429"
                logger.warning("LLM 429 sur %s : reset %.1fs", target, delay)
                if (q.failures >= self.settings.llm_breaker_threshold
                        or delay > max(1.0, deadline - time.monotonic())):
                    q.open_until = time.monotonic() + min(
                        max(delay, self.settings.llm_breaker_cooldown_s), 60.0)
                    break
                if time.monotonic() + delay > deadline - 0.5:
                    break
                await asyncio.sleep(delay)
                continue

            if code == 404:
                body = (res.text or "").lower()
                if "model" in body:
                    logger.warning("Modele %s indisponible (404), repli", target)
                    _bad_models.add(target)
                    target = await self._model_for(purpose, client)
                    payload["model"] = target
                    if is_gpt_oss(target):
                        payload["reasoning_effort"] = self.settings.llm_reasoning_effort
                        payload["include_reasoning"] = bool(self.settings.llm_include_reasoning)
                    else:
                        payload.pop("reasoning_effort", None)
                        payload.pop("include_reasoning", None)
                    continue
                last_err = "HTTP 404"
                break

            if code == 400:
                body = (res.text or "").lower()
                dropped = False
                for field in ("response_format", "reasoning_effort",
                              "include_reasoning", "temperature"):
                    if field in body and field in payload:
                        payload.pop(field, None)
                        dropped = True
                if dropped:
                    logger.warning("Parametre refuse par %s, repli : %s",
                                   target, body[:120])
                    continue
                last_err = f"HTTP 400 : {body[:160]}"
                break

            if code >= 500:
                last_err = f"HTTP {code}"
                if time.monotonic() + 0.6 > deadline:
                    break
                await asyncio.sleep(min(0.6 * (attempt + 1),
                                        max(0.0, deadline - time.monotonic())))
                continue

            try:
                res.raise_for_status()
                data = res.json()
                choice = (data.get("choices") or [{}])[0]
                msg = choice.get("message") or {}
                content = (msg.get("content") or "").strip()
                finish = choice.get("finish_reason")
            except Exception as exc:
                last_err = f"reponse illisible : {exc}"
                break

            if content:
                q.failures = 0
                q.blocked_until = 0.0
                return {"content": content, "error": None, "model": target,
                        "attempts": attempt + 1, "finish_reason": finish,
                        "usage": data.get("usage") or {},
                        "elapsed_ms": int((time.monotonic() - t0) * 1000)}

            # content vide : raisonnement ayant mange le budget de tokens
            if finish == "length" and not grew:
                grew = True
                tokens = min(int(tokens * 2.5), 4096)
                payload["max_tokens"] = tokens
                est = tokens + len(prompt) // 3 + len(system) // 3
                logger.warning("Reponse vide (finish=length) sur %s : "
                               "max_tokens -> %s", target, tokens)
                if time.monotonic() < deadline - 0.8:
                    continue
            last_err = f"reponse vide (finish_reason={finish})"
            break

        q = _quota(target)
        q.failures += 1
        if q.failures >= self.settings.llm_breaker_threshold:
            q.open_until = time.monotonic() + self.settings.llm_breaker_cooldown_s
        logger.error("LLM %s indisponible : %s", purpose, last_err)
        return {"content": "", "error": last_err, "model": target,
                "elapsed_ms": int((time.monotonic() - t0) * 1000)}


_llm: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
