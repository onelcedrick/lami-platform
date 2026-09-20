#!/bin/bash
set -e

cd "$(dirname "$0")"

echo " Configuration Go..."
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off

echo ""
echo " Étape 1 : Résolution des dépendances (go mod tidy)"

# D'abord le module shared (dépendance de tous les autres)
echo "  → shared"
(cd shared && go mod tidy)

# Ensuite chaque service
for svc in user auth catalog order ticket notification analytics; do
  echo "  → services/$svc"
  (cd services/$svc && go mod tidy)
done

echo "  → api-gateway"
(cd api-gateway && go mod tidy)

echo ""
echo " Étape 2 : Compilation"

mkdir -p bin

for svc in user auth catalog order ticket notification analytics; do
  echo "  → $svc"
  (cd services/$svc && CGO_ENABLED=0 GOOS=linux go build -o ../../bin/$svc-service ./cmd/main.go)
done

echo "  → api-gateway"
(cd api-gateway && CGO_ENABLED=0 GOOS=linux go build -o ../bin/api-gateway ./cmd/main.go)

echo ""
echo " Binaires compilés dans bin/"
ls -lh bin/
