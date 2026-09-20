# syntax=docker/dockerfile:1.4
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Proxy Go rapide + désactivation vérification somme
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=off
ENV GOTOOLCHAIN=local

RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/catalog/ /app/services/catalog/

WORKDIR /app/services/catalog

# Cache persistant entre builds (évite re-téléchargement)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /catalog-service ./cmd/main.go

FROM alpine:3.20

# Miroir Alpine rapide
RUN sed -i "s|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g" /etc/apk/repositories && \
    apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /catalog-service .
EXPOSE 8083
CMD ["./catalog-service"]
