FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY api-gateway/ /app/api-gateway/

WORKDIR /app/api-gateway
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /api-gateway ./cmd/main.go

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /api-gateway .
EXPOSE 8000
CMD ["./api-gateway"]
