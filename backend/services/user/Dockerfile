FROM golang:1.22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/user/ /app/services/user/

WORKDIR /app/services/user
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /user-service ./cmd/main.go

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /user-service .
EXPOSE 8082
CMD ["./user-service"]
