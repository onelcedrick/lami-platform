"""
Historique des conversations — version transactionnelle et concurrente.

Garanties :
  G1  le message utilisateur est persiste AVANT tout appel LLM (fait dans routes)
  G2  chaque message recoit un `seq` strictement croissant PAR conversation,
      obtenu par un compteur atomique -> ordre stable meme en ecriture simultanee
      (BSON tronque created_at a la milliseconde : illisible comme cle de tri)
  G3  creation de conversation idempotente (upsert + $setOnInsert) et respect
      de l'identifiant fourni par le client
  G4  retries sur erreur Mongo transitoire
  G5  insertion de message idempotente (upsert sur _id) -> pas de doublon
      si le client rejoue sa requete
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import (
    AutoReconnect, ConnectionFailure, ExecutionTimeout, NetworkTimeout,
)

from app.core.config import get_settings
from app.domain.models import (
    Conversation, ConversationDetail, ConversationMessage, ConversationSummary,
    MessageRole, SourceDocument, ToolCallResult,
)

logger = logging.getLogger("ia.history")

CONVERSATION_TTL_DAYS = 30
DEFAULT_TITLE = "Nouvelle conversation"
TRANSIENT = (AutoReconnect, ConnectionFailure, NetworkTimeout, ExecutionTimeout)


def _deadline(now: datetime) -> datetime:
    return now + timedelta(days=CONVERSATION_TTL_DAYS)


async def _retry(factory: Callable[[], Any], attempts: int = 3, base: float = 0.15):
    """Rejoue une operation Mongo sur erreur reseau transitoire."""
    last: Optional[Exception] = None
    for i in range(attempts):
        try:
            return await factory()
        except TRANSIENT as exc:
            last = exc
            logger.warning("Mongo transitoire (tentative %s) : %s", i + 1, exc)
            await asyncio.sleep(base * (2 ** i))
    raise last  # type: ignore[misc]


class ChatHistoryService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.conversations = db["conversations"]
        self.messages = db["messages"]

    async def ensure_indexes(self) -> None:
        await self.conversations.create_index("user_id")
        await self.conversations.create_index("session_id")
        await self.conversations.create_index("last_message_at")
        # tri stable des messages : (conversation_id, seq)
        await self.messages.create_index([("conversation_id", 1), ("seq", 1)])
        await self.messages.create_index([("conversation_id", 1), ("created_at", 1)])
        await self.messages.create_index("request_id")
        await self.conversations.create_index("expires_at", expireAfterSeconds=0)
        await self.messages.create_index("expires_at", expireAfterSeconds=0)

    # ------------------------------------------------------------
    async def create_conversation(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        mode: str = "auto",
        conversation_id: Optional[str] = None,
    ) -> Conversation:
        now = datetime.now(timezone.utc)
        cid = str(conversation_id or uuid4())
        doc = {
            "user_id": user_id,
            "session_id": session_id,
            "title": DEFAULT_TITLE,
            "mode": mode,
            "message_count": 0,
            "seq": 0,
            "last_message_at": now,
            "created_at": now,
            "expires_at": _deadline(now),
        }
        # upsert + $setOnInsert = atomique : deux creations simultanees du meme
        # id ne produisent ni doublon ni DuplicateKeyError.
        res = await _retry(lambda: self.conversations.update_one(
            {"_id": cid}, {"$setOnInsert": doc}, upsert=True
        ))
        if res.upserted_id is None:
            existing = await self.get_conversation(cid)
            if existing:
                return existing
        return Conversation(
            id=cid, user_id=user_id, session_id=session_id, title=DEFAULT_TITLE,
            mode=mode, message_count=0, last_message_at=now, created_at=now,
            expires_at=_deadline(now),
        )

    async def get_or_create(
        self,
        conversation_id: Optional[str],
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        mode: str = "auto",
    ) -> Conversation:
        if conversation_id:
            existing = await self.get_conversation(conversation_id)
            if existing:
                return existing
            # on RESPECTE l'id client : les messages atterrissent ou il attend
            return await self.create_conversation(
                user_id=user_id, session_id=session_id, mode=mode,
                conversation_id=conversation_id,
            )
        return await self.create_conversation(
            user_id=user_id, session_id=session_id, mode=mode
        )

    # ------------------------------------------------------------
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        doc = await _retry(lambda: self.conversations.find_one({"_id": conversation_id}))
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        allowed = Conversation.model_fields.keys()
        return Conversation(**{k: v for k, v in doc.items() if k in allowed})

    async def list_conversations(
        self, user_id: Optional[str] = None,
        session_id: Optional[str] = None, limit: int = 50,
    ) -> list[ConversationSummary]:
        query: dict = {}
        if user_id:
            query["user_id"] = user_id
        elif session_id:
            query["session_id"] = session_id
        else:
            return []
        docs = await _retry(lambda: self.conversations.find(query)
                            .sort("last_message_at", -1).limit(limit)
                            .to_list(length=limit))
        return [
            ConversationSummary(
                id=str(d["_id"]),
                title=d.get("title") or "Sans titre",
                mode=d.get("mode") or "auto",
                message_count=int(d.get("message_count") or 0),
                last_message_at=d.get("last_message_at") or d.get("created_at"),
                created_at=d.get("created_at") or d.get("last_message_at"),
            )
            for d in docs
        ]

    async def find_by_request_id(
        self, conversation_id: str, request_id: Optional[str]
    ) -> Optional[dict]:
        if not request_id:
            return None
        return await _retry(lambda: self.messages.find_one(
            {"conversation_id": conversation_id, "request_id": request_id}
        ))

    def _to_message(self, d: dict) -> ConversationMessage:
        return ConversationMessage(
            id=str(d["_id"]),
            role=d["role"],
            content=d["content"],
            mode=d.get("mode"),
            sources=[SourceDocument(**s) for s in d.get("sources", []) or []],
            tool_calls=[ToolCallResult(**t) for t in d.get("tool_calls", []) or []],
            cart_added=d.get("cart_added", 0),
            latency_ms=d.get("latency_ms", 0),
            created_at=d["created_at"],
        )

    async def get_messages(
        self, conversation_id: str, limit: int = 500
    ) -> list[ConversationMessage]:
        docs = await _retry(lambda: self.messages.find(
            {"conversation_id": conversation_id}
        ).sort([("seq", 1), ("created_at", 1)]).to_list(length=limit))
        return [self._to_message(d) for d in docs]

    async def get_recent_messages(
        self, conversation_id: str, limit: int = 8
    ) -> list[ConversationMessage]:
        docs = await _retry(lambda: self.messages.find(
            {"conversation_id": conversation_id},
            {"role": 1, "content": 1, "created_at": 1, "seq": 1},
        ).sort([("seq", -1), ("created_at", -1)]).limit(limit).to_list(length=limit))
        return [self._to_message(d) for d in reversed(docs)]

    async def get_detail(self, conversation_id: str) -> Optional[ConversationDetail]:
        conv = await self.get_conversation(conversation_id)
        if not conv:
            return None
        return ConversationDetail(
            id=conv.id, title=conv.title, mode=conv.mode,
            messages=await self.get_messages(conversation_id),
            created_at=conv.created_at, last_message_at=conv.last_message_at,
        )

    # ------------------------------------------------------------
    async def _next_seq(self, conversation_id: str, now: datetime) -> Optional[int]:
        state = await _retry(lambda: self.conversations.find_one_and_update(
            {"_id": conversation_id},
            {"$inc": {"message_count": 1, "seq": 1},
             "$set": {"last_message_at": now, "expires_at": _deadline(now)}},
            projection={"seq": 1},
            return_document=ReturnDocument.AFTER,
        ))
        if state is None:
            return None
        return int(state.get("seq") or 1)

    async def add_message(
        self,
        conversation_id: str,
        role: MessageRole,
        content: str,
        mode: Optional[str] = None,
        sources: Optional[list[SourceDocument]] = None,
        tool_calls: Optional[list[ToolCallResult]] = None,
        cart_added: int = 0,
        latency_ms: int = 0,
        request_id: Optional[str] = None,
    ) -> ConversationMessage:
        now = datetime.now(timezone.utc)

        seq = await self._next_seq(conversation_id, now)
        if seq is None:
            # conversation expiree / supprimee : on la recree pour ne rien perdre
            logger.warning("Conversation %s absente, recreation", conversation_id)
            await self.create_conversation(conversation_id=conversation_id)
            seq = await self._next_seq(conversation_id, now)
            if seq is None:
                raise RuntimeError(f"Conversation impossible a creer : {conversation_id}")

        msg = ConversationMessage(
            id=str(uuid4()), role=role, content=content, mode=mode,
            sources=sources or [], tool_calls=tool_calls or [],
            cart_added=cart_added, latency_ms=latency_ms, created_at=now,
        )
        doc = msg.model_dump()
        doc["_id"] = doc.pop("id")
        doc["conversation_id"] = conversation_id
        doc["seq"] = seq
        doc["expires_at"] = _deadline(now)
        if request_id:
            doc["request_id"] = request_id

        mid = doc["_id"]
        try:
            await _retry(lambda: self.messages.update_one(
                {"_id": mid}, {"$setOnInsert": doc}, upsert=True
            ))
        except Exception:
            # le message n'a pas ete ecrit : on rend le compteur, on garde seq
            # (un trou dans seq est inoffensif, un doublon ne l'est pas)
            await self.conversations.update_one(
                {"_id": conversation_id}, {"$inc": {"message_count": -1}}
            )
            raise

        if role == MessageRole.USER:
            clean = " ".join(content.split())
            title = clean[:60] + ("..." if len(clean) > 60 else "")
            # filtre conditionnel => atomique, un seul ecrivain gagne
            await _retry(lambda: self.conversations.update_one(
                {"_id": conversation_id, "title": DEFAULT_TITLE},
                {"$set": {"title": title}},
            ))
        return msg

    async def rename_conversation(self, conversation_id: str, title: str) -> bool:
        res = await _retry(lambda: self.conversations.update_one(
            {"_id": conversation_id}, {"$set": {"title": title[:100]}}
        ))
        return res.matched_count > 0

    async def delete_conversation(self, conversation_id: str) -> bool:
        await _retry(lambda: self.messages.delete_many(
            {"conversation_id": conversation_id}
        ))
        res = await _retry(lambda: self.conversations.delete_one(
            {"_id": conversation_id}
        ))
        return res.deleted_count > 0

    # ------------------------------------------------------------
    async def get_stats(self) -> dict:
        total_conv = await self.conversations.count_documents({})
        total_msg = await self.messages.count_documents({})
        modes = await self.conversations.aggregate([
            {"$group": {"_id": "$mode", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]).to_list(20)
        detected = await self.messages.aggregate([
            {"$match": {"role": "assistant", "mode": {"$ne": None}}},
            {"$group": {"_id": "$mode", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]).to_list(20)
        lat = await self.messages.aggregate([
            {"$match": {"latency_ms": {"$gt": 0}}},
            {"$group": {"_id": None, "avg": {"$avg": "$latency_ms"},
                        "max": {"$max": "$latency_ms"}}},
        ]).to_list(1)
        return {
            "total_conversations": total_conv,
            "total_messages": total_msg,
            "modes": {m["_id"] or "unknown": m["count"] for m in modes},
            "detected_modes": {m["_id"]: m["count"] for m in detected},
            "avg_latency_ms": round(lat[0]["avg"], 1) if lat else 0,
            "max_latency_ms": round(lat[0]["max"], 1) if lat else 0,
        }


# ------------------------------------------------------------
_history_service: Optional[ChatHistoryService] = None
_mongo_client: Optional[AsyncIOMotorClient] = None
_init_lock = asyncio.Lock()


async def get_chat_history() -> ChatHistoryService:
    global _history_service, _mongo_client
    if _history_service is not None:
        return _history_service
    async with _init_lock:
        if _history_service is None:
            settings = get_settings()
            client = AsyncIOMotorClient(settings.mongo_uri, tz_aware=True)
            svc = ChatHistoryService(client[settings.mongo_db])
            await svc.ensure_indexes()
            _mongo_client = client
            _history_service = svc
    return _history_service


async def close_chat_history() -> None:
    global _history_service, _mongo_client
    if _mongo_client is not None:
        _mongo_client.close()
    _history_service = None
    _mongo_client = None
