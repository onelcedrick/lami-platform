# L'AMI IA Service

Service Python FastAPI : RAG (support technique) + Agent Function Calling (conversational commerce).

## Architecture

```
app/
├── api/           # Routes FastAPI
├── agent/         # Orchestrateur, LLM, Tools (Function Calling)
├── rag/           # Embeddings, Vector Store, Pipeline RAG
├── domain/        # Modeles Pydantic
├── core/          # Config, JWT
└── services/      # Seed knowledge base
```

## Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/ia/health` | Sante du service |
| POST | `/api/v1/ia/chat` | Chat unifie (auto/support/commerce) |
| POST | `/api/v1/ia/rag/search` | Recherche vectorielle seule |
| POST | `/api/v1/ia/knowledge/ingest` | Indexer des documents (admin) |
| GET | `/api/v1/ia/knowledge/documents` | Lister documents |
| POST | `/api/v1/ia/knowledge/seed` | Charger base demo |
| GET | `/api/v1/ia/tools` | Schemas des outils agent |

## Modes LLM

Variable `LLM_PROVIDER` :
- `mock` (defaut) : reponses deterministes, zero dependance externe
- `ollama` : Llama 3.1 / Mistral en local (`OLLAMA_BASE_URL`)
- `openai_compatible` : API OpenAI ou compatible (`OPENAI_API_KEY`)

## Tools (Function Calling)

- `search_products` - Catalogue
- `get_product` - Detail produit
- `list_categories` - Categories
- `suggest_pc_build` - Configurateur usage + budget
- `create_support_ticket` - Ticket support

## Demarrage local

```bash
cd backend/services/ia
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

Docs interactives : http://localhost:8090/docs
