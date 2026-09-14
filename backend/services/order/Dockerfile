FROM golang:1.22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/order/ /app/services/order/

WORKDIR /app/services/order
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /order-service ./cmd/main.go

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /order-service .
EXPOSE 8084
CMD ["./order-service"]
