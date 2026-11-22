"""Configuration centralisee (12-factor)."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "L'AMI IA Service"
    environment: str = "development"
    http_port: int = 8007

    # LLM
    llm_provider: str = "groq"  # groq | openai | openai_compatible | mock
    groq_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    groq_model: str = "openai/gpt-oss-120b"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    llm_timeout_s: float = 20.0
    llm_max_tokens: int = 1024

    # Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embeddings_backend: str = ""  # hash | sentence-transformers | auto

    # Mongo
    mongo_uri: str = "mongodb://mongo:27017"
    mongo_db: str = "lami_ia"

    # Microservices internes
    catalog_url: str = "http://catalog-service:8083"
    ticket_url: str = "http://ticket-service:8085"
    order_url: str = "http://order-service:8084"
    gateway_url: str = "http://gateway:8000"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # RAG
    rag_top_k: int = 3
    rag_min_score: float = 0.25

    # Perf
    target_latency_ms: int = 2500


@lru_cache
def get_settings() -> Settings:
    return Settings()
