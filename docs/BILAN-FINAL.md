# Bilan final — L'AMI Platform (Master II)

## Identite

Plateforme e-commerce composants PC + support technique + IA conversationnelle  
Localisation : Madagascar (Toamasina), prix en Ariary (MGA), Mobile Money.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 16.3.4 (App Router, Turbopack) + React 19 + Tailwind + Zustand |
| API Gateway | Go Fiber — JWT, CORS, rate limit, /metrics |
| Microservices | Auth, User, Catalog, Order, Ticket, Notification, Analytics |
| IA | Python FastAPI — RAG + function calling (config PC → panier) |
| Data | MongoDB, Redis, RabbitMQ |
| Storage | MinIO (fichiers tickets) |
| CI | GitHub Actions |

## Architecture routes frontend (sans conflit)

| Zone | Prefixe URL |
|------|-------------|
| Public / client | `/`, `/catalog`, `/product/[slug]`, `/cart`, `/orders`, `/tickets`, `/favorites`, `/profile` |
| Auth | `/login`, `/register`, `/auth/callback` |
| Admin | `/admin/dashboard`, `/admin/products`, `/admin/orders`, `/admin/tickets`, … |
| Technicien | `/technician/dashboard`, `/technician/tickets` |

## Fonctionnalites livrees

### Commerce
- Catalogue, recherche intelligente + autosuggest
- Panier + badge quantite, favoris
- Commandes, Mobile Money webhook
- Prix / promos recalcules **cote serveur** a CreateOrder
- Partage lien produit
- Import produits CSV (admin)
- Produits populaires (accueil)
- Config PC **uniquement via chat IA** 

### Support
- Tickets client / technicien
- Chat messages + fichiers (image, PDF) via MinIO
- SSE / polling

### IA
- RAG catalogue
- suggest_pc_build → confirmation → add_build_to_cart
- Session pending_build

### Admin
- CRUD produits, categories, stock, prix Ar
- Promotions (% ou montant)
- Commandes, tickets, utilisateurs
- Rapports CA, visiteurs, journal activites
- Parametres boutique
- Facture JSON + **PDF** (`/orders/:id/invoice.pdf`)

### Transverse
- OAuth Google
- SEO / GEO Madagascar
- Mode clair / sombre
- RabbitMQ events (stock, sales_count, notifs)
- Prometheus metrics + X-Request-ID
- E2E Playwright smoke
- Docker Compose complet

## Tests verifies

- Order service (application) : PASS
- JWT shared : PASS
- Routes frontend : 23 uniques, 0 conflit

## Points d attention (non bloquants)

1. Pousser le code source **complet** sur GitHub depuis le zip (API limite les batches)
2. `npm install` local obligatoire (Next 16 + Playwright)
3. OTEL full OTLP exporter = optionnel post-soutenance
4. E2E elargi (login → commande → chat) = optionnel

## Verdict

**Pret pour soutenance Master II.**  
Le coeur metier du cahier des charges est implemente.
