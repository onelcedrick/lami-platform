"""
Service de gestion de l'historique des conversations IA.

Persiste chaque échange dans MongoDB (lami_ia) pour :
- Retrouver ses conversations passées
- Analyser les usages (M2 Data Science)
- Respecter le RGPD (TTL 30 jours)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.domain.models import (
    Conversation,
    ConversationDetail,
    ConversationMessage,
    ConversationSummary,
    MessageRole,
    SourceDocument,
    ToolCallResult,
)


CONVERSATION_TTL_DAYS = 30


class ChatHistoryService:
    """CRUD conversations + messages."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.conversations = db["conversations"]
        self.messages = db["messages"]

    async def ensure_indexes(self) -> None:
        # Index utilisateur + session
        await self.conversations.create_index("user_id")
        await self.conversations.create_index("session_id")
        await self.conversations.create_index("last_message_at")
        # Index messages
        await self.messages.create_index("conversation_id")
        await self.messages.create_index("created_at")
        # TTL 30 jours
        await self.conversations.create_index(
            "expires_at",
            expireAfterSeconds=0,
        )

    # ------------------------------------------------------------
    # Création
    # ------------------------------------------------------------
    async def create_conversation(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        mode: str = "auto",
    ) -> Conversation:
        now = datetime.now(timezone.utc)
        conv = Conversation(
            id=str(uuid4()),
            user_id=user_id,
            session_id=session_id,
            title="Nouvelle conversation",
            mode=mode,
            message_count=0,
            last_message_at=now,
            created_at=now,
            expires_at=now + timedelta(days=CONVERSATION_TTL_DAYS),
        )
        await self.conversations.insert_one(conv.model_dump())
        return conv

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
        return await self.create_conversation(
            user_id=user_id, session_id=session_id, mode=mode
        )

    # ------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        doc = await self.conversations.find_one({"_id": conversation_id})
        if not doc:
            return None
        doc["id"] = doc.pop("_id")
        return Conversation(**doc)

    async def list_conversations(
        self,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[ConversationSummary]:
        query: dict = {}
        if user_id:
            query["user_id"] = user_id
        elif session_id:
            query["session_id"] = session_id
        else:
            return []

        cursor = (
            self.conversations.find(query)
            .sort("last_message_at", -1)
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        return [
            ConversationSummary(
                id=str(d.get("id") or d["_id"]),
                title=d.get("title") or "Sans titre",
                mode=d.get("mode") or "auto",
                message_count=int(d.get("message_count") or 0),
                last_message_at=d.get("last_message_at") or d.get("created_at"),
                created_at=d.get("created_at") or d.get("last_message_at"),
            )
            for d in docs
        ]

    async def get_messages(self, conversation_id: str) -> list[ConversationMessage]:
        cursor = self.messages.find(
            {"conversation_id": conversation_id}
        ).sort("created_at", 1)
        docs = await cursor.to_list(length=500)
        return [
            ConversationMessage(
                id=d["_id"],
                role=d["role"],
                content=d["content"],
                mode=d.get("mode"),
                sources=[SourceDocument(**s) for s in d.get("sources", [])],
                tool_calls=[ToolCallResult(**t) for t in d.get("tool_calls", [])],
                cart_added=d.get("cart_added", 0),
                latency_ms=d.get("latency_ms", 0),
                created_at=d["created_at"],
            )
            for d in docs
        ]

    async def get_detail(self, conversation_id: str) -> Optional[ConversationDetail]:
        conv = await self.get_conversation(conversation_id)
        if not conv:
            return None
        messages = await self.get_messages(conversation_id)
        return ConversationDetail(
            id=conv.id,
            title=conv.title,
            mode=conv.mode,
            messages=messages,
            created_at=conv.created_at,
            last_message_at=conv.last_message_at,
        )

    # ------------------------------------------------------------
    # Écriture
    # ------------------------------------------------------------
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
    ) -> ConversationMessage:
        now = datetime.now(timezone.utc)
        msg = ConversationMessage(
            id=str(uuid4()),
            role=role,
            content=content,
            mode=mode,
            sources=sources or [],
            tool_calls=tool_calls or [],
            cart_added=cart_added,
            latency_ms=latency_ms,
            created_at=now,
        )
        # Insertion du message
        msg_doc = msg.model_dump()
        msg_doc["_id"] = msg_doc.pop("id")
        msg_doc["conversation_id"] = conversation_id
        await self.messages.insert_one(msg_doc)

        # Mise à jour de la conversation
        update: dict = {
            "$inc": {"message_count": 1},
            "$set": {
                "last_message_at": now,
                "expires_at": now + timedelta(days=CONVERSATION_TTL_DAYS),
            },
        }
        # Auto-titre au premier message utilisateur
        if role == MessageRole.USER:
            conv = await self.get_conversation(conversation_id)
            if conv and conv.title == "Nouvelle conversation":
                title = content.strip().split("\n")[0][:60]
                if len(content) > 60:
                    title += "…"
                update["$set"]["title"] = title

        await self.conversations.update_one({"_id": conversation_id}, update)
        return msg

    async def rename_conversation(self, conversation_id: str, title: str) -> bool:
        res = await self.conversations.update_one(
            {"_id": conversation_id},
            {"$set": {"title": title[:100]}},
        )
        return res.modified_count > 0

    # ------------------------------------------------------------
    # Suppression
    # ------------------------------------------------------------
    async def delete_conversation(self, conversation_id: str) -> bool:
        await self.messages.delete_many({"conversation_id": conversation_id})
        res = await self.conversations.delete_one({"_id": conversation_id})
        return res.deleted_count > 0

    # ------------------------------------------------------------
    # Analytics (pour ton rapport M2)
    # ------------------------------------------------------------
    async def get_stats(self) -> dict:
        total_conv = await self.conversations.count_documents({})
        total_msg = await self.messages.count_documents({})
        # Répartition par mode
        pipeline_mode = [
            {"$group": {"_id": "$mode", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        modes = await self.conversations.aggregate(pipeline_mode).to_list(20)
        # Latence moyenne
        pipeline_lat = [
            {"$match": {"latency_ms": {"$gt": 0}}},
            {
                "$group": {
                    "_id": None,
                    "avg": {"$avg": "$latency_ms"},
                    "max": {"$max": "$latency_ms"},
                }
            },
        ]
        lat = await self.messages.aggregate(pipeline_lat).to_list(1)
        return {
            "total_conversations": total_conv,
            "total_messages": total_msg,
            "modes": {m["_id"] or "unknown": m["count"] for m in modes},
            "avg_latency_ms": round(lat[0]["avg"], 1) if lat else 0,
            "max_latency_ms": round(lat[0]["max"], 1) if lat else 0,
        }


# Singleton
_history_service: Optional[ChatHistoryService] = None
_mongo_client: Optional[AsyncIOMotorClient] = None


async def get_chat_history() -> ChatHistoryService:
    global _history_service, _mongo_client
    if _history_service is None:
        settings = get_settings()
        _mongo_client = AsyncIOMotorClient(settings.mongo_uri)
        db = _mongo_client[settings.mongo_db]
        _history_service = ChatHistoryService(db)
        await _history_service.ensure_indexes()
    return _history_service