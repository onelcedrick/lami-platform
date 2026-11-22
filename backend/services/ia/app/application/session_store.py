"""Memoire conversationnelle courte (EF-05) — pending_build, last_reject, etc."""

from __future__ import annotations

from typing import Any

from app.domain.ports import SessionPort


class InMemorySessionStore(SessionPort):
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def get(self, conversation_id: str) -> dict[str, Any]:
        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = {}
        return self._sessions[conversation_id]

    def set(self, conversation_id: str, data: dict[str, Any]) -> None:
        self._sessions[conversation_id] = data

    def update(self, conversation_id: str, **kwargs: Any) -> dict[str, Any]:
        s = self.get(conversation_id)
        s.update(kwargs)
        return s

    def clear_key(self, conversation_id: str, key: str) -> None:
        s = self.get(conversation_id)
        s.pop(key, None)


_store: InMemorySessionStore | None = None


def get_session_store() -> InMemorySessionStore:
    global _store
    if _store is None:
        _store = InMemorySessionStore()
    return _store
