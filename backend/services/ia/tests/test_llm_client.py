from types import SimpleNamespace

import pytest

from app.infrastructure import llm


@pytest.mark.asyncio
async def test_openai_compatible_provider_uses_configured_url(monkeypatch):
    request = {}

    class MockResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "Réponse du LLM"}}]}

    class MockAsyncClient:
        def __init__(self, timeout):
            assert timeout == 7

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            request["url"] = url
            request.update(kwargs)
            return MockResponse()

    monkeypatch.setattr(llm, "get_settings", lambda: SimpleNamespace(
        llm_provider="openai_compatible",
        openai_api_key="test-key",
        openai_base_url="https://api.groq.com/openai/v1/",
        openai_model="llama-3.3-70b-versatile",
        llm_timeout_s=7,
        llm_max_tokens=128,
    ))
    monkeypatch.setattr(llm.httpx, "AsyncClient", MockAsyncClient)

    client = llm.LLMClient()
    response = await client.generate("Bonjour")

    assert response == "Réponse du LLM"
    assert request["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert request["headers"]["Authorization"] == "Bearer test-key"
    assert request["json"]["model"] == "llama-3.3-70b-versatile"