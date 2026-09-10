# Lot final — L'AMI Master II

## Livre

1. **PDF factures** — `GET /api/v1/orders/:id/invoice.pdf` (commande payee)
2. **Observabilite** — `/metrics` Prometheus + `X-Request-ID` / latence (otel leger)
3. **E2E Playwright** — `frontend/e2e/smoke.spec.ts` (`npm run test:e2e`)
4. **Next.js 16.3.4** + React 19

## Coeur metier (deja en place)

- Microservices Go + Clean Architecture
- RabbitMQ (stock / ventes / notifs)
- Prix serveur + promos
- IA config PC → panier
- Mobile Money webhook
- MinIO, admin CRUD, rapports CA

## Pas de lot bloquant restant pour la soutenance

Optionnel post-soutenance : OTLP full exporter, PDF lib graphique, coverage e2e elargi.
