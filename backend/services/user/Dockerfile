# syntax=docker/dockerfile:1.4
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Proxy Go rapide + désactivation vérification somme
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=off
ENV GOTOOLCHAIN=local

RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/user/ /app/services/user/

WORKDIR /app/services/user

# Cache persistant entre builds (évite re-téléchargement)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /user-service ./cmd/main.go

FROM alpine:3.20

# Miroir Alpine rapide
RUN sed -i "s|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g" /etc/apk/repositories && \
    apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /user-service .
EXPOSE 8082
CMD ["./user-service"]
