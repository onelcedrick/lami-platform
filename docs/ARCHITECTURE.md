# Architecture L'AMI

Microservices Go (Clean Architecture) + Next.js 14 + IA Python FastAPI.

## Flux commande
1. Client cree commande (prix recalcule serveur)
2. Event order.created (RabbitMQ)
3. Catalog decremente stock + sales_count
4. Notification + analytics
5. Webhook Mobile Money -> order.paid

## Config PC IA
Chat only: suggest_pc_build -> pending_build -> add_to_cart
