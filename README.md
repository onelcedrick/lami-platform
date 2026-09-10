# L'AMI Platform (Master II)

Plateforme e-commerce + support technique + IA conversationnelle (RAG + Function Calling)
pour composants PC a Madagascar (Fianarantsoa).

**UTF-8 · icones SVG · pas d'emoji · prix en Ariary (MGA)**

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 (App Router) + Tailwind + Zustand |
| API Gateway | Go (Fiber) — JWT, CORS, rate limit, `/metrics` |
| Microservices | Auth, Catalog, Order, Ticket, Notification, User, Analytics |
| IA | Python FastAPI — RAG + tools (config PC, panier, tickets) |
| Data | MongoDB (par service), Redis, RabbitMQ |
| Storage | MinIO (fichiers tickets) ou disque local |
| CI | GitHub Actions (Go tests, Python tests, docker-compose config) |

## Architecture

```
Client (Next.js :3000)
        |
   API Gateway (:8000)
        |
  +-----+------+--------+--------+---------+
  |     |      |        |        |         |
Auth Catalog Order  Ticket  User/Notif  Analytics
  |     |      |        |        |         |
 Mongo  Mongo Mongo   Mongo   Mongo      Mongo
               |
            RabbitMQ  --> Catalog (stock/sales), Notification, Analytics
               |
            MinIO (uploads tickets)
  IA Service (:8090) <-- tools HTTP vers Catalog / Ticket
```

## Fonctionnalites cles

- Catalogue, panier, commandes, Mobile Money (webhook)
- Prix et promos recalcules **cote serveur** a la commande
- Favoris + panier synchronises compte
- Tickets client/technicien + fichiers (image, PDF)
- Assistant IA : config PC (usage + budget Ar) → confirmation → **ajout panier auto**
- Admin : produits CRUD, import CSV, promotions, rapports CA, parametres boutique, factures
- SEO / GEO Madagascar, mode clair/sombre, recherche intelligente

## Demarrage rapide

### Prerequisites
- Docker & Docker Compose
- Go 1.22+ (dev local)
- Node.js 20+
- Python 3.11+ (service IA)

### 1. Infrastructure + services

```bash
cp .env.example .env   # ajuster JWT_SECRET en production
docker compose up -d --build
```

Services exposes :
- Frontend : http://localhost:3000
- API Gateway : http://localhost:8000
- RabbitMQ UI : http://localhost:15672 (lami / lami_secret)
- MinIO console : http://localhost:9001 (lami / lami_secret_minio)
- Metrics : http://localhost:8000/metrics

### 2. Frontend (dev)

```bash
cd frontend
npm install
npm run dev
```

### 3. Tests

```bash
cd backend/services/order && go test ./internal/application/ -v
cd backend/shared && go test ./pkg/jwt/ -v
cd backend/services/ia && pytest tests/test_cart_flow.py -q
```

## Config PC (sans page dediee)

Tout passe par le **chat Assistant L'AMI** :

1. « PC gaming 3 millions Ar »
2. L'IA propose les composants
3. « Oui, ajoute au panier »
4. Articles ajoutes automatiquement

## Securite (rappel prod)

- `JWT_SECRET` fort, `APP_ENV=production`
- `CORS_ORIGINS` restreint
- `MOMO_WEBHOOK_SECRET` pour callbacks Mobile Money
- Ne jamais committer `.env`

## Structure

```
lami-platform/
├── backend/
│   ├── api-gateway/
│   ├── services/   # auth, catalog, order, ticket, notification, user, analytics, ia
│   └── shared/
├── frontend/
├── docs/
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Academique

Projet Master II — L'AMI (Assistance & Maintenance Informatique).
