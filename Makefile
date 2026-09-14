.PHONY: test test-go test-ia build-go docker-up docker-down ci

test: test-go test-ia

test-go:
	cd backend/shared && go test ./... -count=1
	cd backend/services/order && go test ./... -count=1

test-ia:
	cd backend/services/ia && PYTHONPATH=. python -m pytest tests/ -v --tb=short

build-go:
	cd backend/services/auth && go build -o /tmp/lami-auth ./cmd/main.go
	cd backend/services/catalog && go build -o /tmp/lami-catalog ./cmd/main.go
	cd backend/services/order && go build -o /tmp/lami-order ./cmd/main.go
	cd backend/services/ticket && go build -o /tmp/lami-ticket ./cmd/main.go
	cd backend/services/notification && go build -o /tmp/lami-notif ./cmd/main.go
	cd backend/services/user && go build -o /tmp/lami-user ./cmd/main.go
	cd backend/api-gateway && go build -o /tmp/lami-gateway ./cmd/main.go

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

ci: test build-go
	docker compose config
	@echo "CI local OK"
