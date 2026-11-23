"""Configuration centralisee (12-factor) — service IA L'AMI."""
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "L'AMI IA Service"
    environment: str = "development"
    http_port: int = 8090

    # ---- LLM (Groq, API OpenAI-compatible) ----
    llm_provider: str = "groq"
    groq_api_key: str = Field(
        default="", validation_alias=AliasChoices("GROQ_API_KEY", "OPENAI_API_KEY")
    )
    groq_model: str = Field(
        default="openai/gpt-oss-120b",
        validation_alias=AliasChoices("GROQ_MODEL", "OPENAI_MODEL"),
    )
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "openai/gpt-oss-120b"

    # Modeles par etage. Vide = resolution automatique via GET /models.
    # llama-3.1-8b-instant et llama-3.3-70b-versatile ont ete RETIRES le
    # 16/08/2026 (free/developer) -> ne plus les utiliser.
    nlu_model: str = Field(
        default="openai/gpt-oss-20b",
        validation_alias=AliasChoices("NLU_MODEL", "LLM_NLU_MODEL"),
    )
    llm_model_nlu: str = ""
    llm_model_nlg: str = ""

    nlu_max_tokens: int = 512      # gpt-oss consomme des tokens de raisonnement
    nlg_max_tokens: int = 900
    llm_max_tokens: int = 1024
    llm_timeout_s: float = 30.0

    # gpt-oss : raisonnement borne + raisonnement masque
    llm_reasoning_effort: str = "low"     # low | medium | high
    llm_include_reasoning: bool = False

    # Budget de temps par appel (borne la latence utilisateur)
    llm_nlu_budget_s: float = 5.0
    llm_nlg_budget_s: float = 10.0
    llm_max_attempts: int = 3
    llm_breaker_threshold: int = 2
    llm_breaker_cooldown_s: float = 15.0
    llm_max_concurrency: int = 3
    chat_timeout_s: float = 25.0

    # NLU : hybrid (regles puis LLM en arbitrage) | rules | llm
    nlu_strategy: str = "hybrid"
    nlu_cache_ttl_s: float = 900.0

    # ---- Embeddings ----
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embeddings_backend: str = ""

    # ---- Mongo ----
    mongo_uri: str = "mongodb://mongodb:27017"
    mongo_db: str = "lami_ia"

    # ---- Microservices ----
    catalog_url: str = Field(
        default="http://catalog-service:8083",
        validation_alias=AliasChoices("CATALOG_URL", "CATALOG_SERVICE_URL"),
    )
    ticket_url: str = Field(
        default="http://ticket-service:8085",
        validation_alias=AliasChoices("TICKET_URL", "TICKET_SERVICE_URL"),
    )
    order_url: str = Field(
        default="http://order-service:8084",
        validation_alias=AliasChoices("ORDER_URL", "ORDER_SERVICE_URL"),
    )
    gateway_url: str = Field(
        default="http://api-gateway:8000",
        validation_alias=AliasChoices("GATEWAY_URL", "API_GATEWAY_URL"),
    )

    # ---- Auth ----
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # ---- RAG ----
    rag_top_k: int = 3
    rag_min_score: float = 0.25

    target_latency_ms: int = 2500


@lru_cache
def get_settings() -> Settings:
    return Settings()
