# Service IA L'AMI v2 — Clean Architecture

Assistant conversationnel (LLM + RAG + Function Calling) conforme au cahier des charges.

## Architecture

```
app/
  domain/          # Models + Ports (interfaces)
  application/     # Orchestrator, Session, ChatHistory
  infrastructure/  # LLM, RAG, Tools, Embeddings, Mongo
  interfaces/      # FastAPI routes
  core/            # Config, Security
```

## Design patterns

- **Strategy** : routage Support / Commerce / General
- **Registry** : outils function calling
- **Ports & Adapters** (hexagonal)
- **Singleton** (services lazy)

## Endpoints

- `GET  /api/v1/ia/health`
- `POST /api/v1/ia/chat`  body: `{ message, conversation_id?, mode?, context? }`
- Knowledge ingest / search
- Conversations history

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8007
```

Env: `GROQ_API_KEY`, `MONGO_URI`, `CATALOG_URL`, `JWT_SECRET`, `LLM_PROVIDER=groq|mock`
