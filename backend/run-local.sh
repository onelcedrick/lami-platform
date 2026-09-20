#!/bin/bash
# Lance tous les services Go en local (hors Docker)
# Charge les variables depuis .env.local

set -e
cd "$(dirname "$0")"

# Charger les variables d'environnement
set -a
source .env.local
set +a

# Créer le dossier de logs
mkdir -p logs

# S'assurer que les binaires sont compilés
if [ ! -f "bin/catalog-service" ]; then
  echo "🔨 Compilation des binaires..."
  ./build-all.sh
fi

echo ""
echo "🚀 Démarrage des services..."

# Fonction pour lancer un service en arrière-plan
start_service() {
  local name=$1
  local port=$2
  local binary="bin/$name-service"
  
  HTTP_PORT=$port "$binary" > "logs/$name.log" 2>&1 &
  echo $! > "logs/$name.pid"
  echo "  ✅ $name (port $port) — PID $(cat logs/$name.pid)"
}

# Lancer chaque service avec son port
start_service auth 8081
start_service user 8082
start_service catalog 8083
start_service order 8084
start_service ticket 8085
start_service notification 8086
start_service analytics 8087

# API Gateway
HTTP_PORT=8000 ./bin/api-gateway > logs/gateway.log 2>&1 &
echo $! > logs/gateway.pid
echo "   api-gateway (port 8000) — PID $(cat logs/gateway.pid)"

echo ""
echo " Tous les services sont lancés !"
echo ""
echo " Logs : tail -f logs/<service>.log"
echo " Arrêter : ./stop-local.sh"
