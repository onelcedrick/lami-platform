from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "L'AMI IA Service"
    app_env: str = "development"
    http_port: int = 8090

    # MongoDB (documents + vectors)
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "lami_ia"

    # Redis cache
    redis_addr: str = "localhost:6379"

    # JWT (meme secret que les services Go)
    jwt_secret: str = "lami-super-secret-key-change-in-production-2026"

    # Microservices (Function Calling)
    gateway_url: str = "http://localhost:8000"
    catalog_service_url: str = "http://localhost:8083"
    order_service_url: str = "http://localhost:8084"
    ticket_service_url: str = "http://localhost:8085"

    # RAG
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.35
    max_context_chars: int = 4000

    # LLM
    # Mode local par defaut (pas de cle API requise).
    # Options: "mock" | "ollama" | "openai_compatible"
    llm_provider: str = "mock"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
