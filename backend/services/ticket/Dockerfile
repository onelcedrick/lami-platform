FROM golang:1.22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/ticket/ /app/services/ticket/

WORKDIR /app/services/ticket
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /ticket-service ./cmd/main.go

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /ticket-service .
EXPOSE 8085
CMD ["./ticket-service"]
