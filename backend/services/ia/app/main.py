"""Point d'entree FastAPI — Service IA L'AMI."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.application.chat_history import close_chat_history
from app.core.config import get_settings
from app.infrastructure.embeddings import get_embedding_service
from app.infrastructure.llm import close_llm_client
from app.infrastructure.seed import seed_knowledge_base
from app.infrastructure.vector_store import close_vector_store, get_vector_store
from app.interfaces.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ia-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Demarrage IA Service (provider=%s)", settings.llm_provider)

    emb = get_embedding_service()
    logger.info("Embeddings backend: %s (dim=%s)", emb.backend, emb.dimension)

    try:
        store = await get_vector_store()
        count = await seed_knowledge_base()
        total = await store.count()
        logger.info("Base de connaissances: %s documents (seed +%s)", total, count)
    except Exception as e:
        logger.warning("MongoDB indisponible au demarrage: %s", e)

    yield

    await close_llm_client()
    await close_chat_history()
    await close_vector_store()
    logger.info("Arret IA Service")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Service IA L'AMI — Assistant conversationnel "
            "(LLM + RAG + Function Calling) — Clean Architecture"
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["X-Request-Id", 
            "Content-Type",
            "Authorization",
            "X-Session-Id",
            "Accept",
            "Origin",
            "X-Requested-With",
        ],
        expose_headers=["X-Session-Id"],
    )

    app.include_router(router, prefix="/api/v1/ia", tags=["IA"])

    @app.get("/")
    async def root():
        return {
            "service": "lami-ia",
            "version": __version__,
            "docs": "/docs",
            "health": "/api/v1/ia/health",
        }

    return app


app = create_app()
