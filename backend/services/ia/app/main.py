import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.rag.embeddings import get_embedding_service
from app.rag.vector_store import close_vector_store, get_vector_store
from app.services.seed import seed_knowledge_base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ia-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Demarrage IA Service (provider=%s)", settings.llm_provider)

    # Charger embeddings
    emb = get_embedding_service()
    logger.info("Embeddings backend: %s (dim=%s)", emb.backend, emb.dimension)

    # Connexion vector store + seed
    try:
        store = await get_vector_store()
        count = await seed_knowledge_base()
        total = await store.count()
        logger.info("Base de connaissances: %s documents (seed +%s)", total, count)
    except Exception as e:
        logger.warning("MongoDB indisponible au demarrage: %s", e)

    yield

    await close_vector_store()
    logger.info("Arret IA Service")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Service IA L'AMI - RAG support technique + "
            "Agent Function Calling (conversational commerce)"
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router, prefix="/api/v1/ia", tags=["IA"])

    @app.get("/")
    async def root():
        return {
            "service": "lami-ia",
            "docs": "/docs",
            "health": "/api/v1/ia/health",
        }

    return app


app = create_app()
