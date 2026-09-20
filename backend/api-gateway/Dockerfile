# syntax=docker/dockerfile:1.4
FROM golang:1.22-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=off
ENV GOTOOLCHAIN=local

RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY api-gateway/ /app/api-gateway/

WORKDIR /app/api-gateway

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /api-gateway ./cmd/main.go

FROM alpine:3.20

RUN sed -i "s|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g" /etc/apk/repositories && \
    apk --no-cache add ca-certificates

WORKDIR /root/
COPY --from=builder /api-gateway .
EXPOSE 8000
CMD ["./api-gateway"]
