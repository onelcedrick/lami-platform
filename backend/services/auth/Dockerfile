FROM golang:1.22-alpine AS builder

WORKDIR /app
ENV GOPROXY=https://goproxy.io,https://proxy.golang.org,direct
ENV GOSUMDB=off
ENV GOTOOLCHAIN=local

RUN apk add --no-cache git

COPY shared/ /app/shared/
COPY services/auth/ /app/services/auth/

WORKDIR /app/services/auth
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /auth-service ./cmd/main.go

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /auth-service .
EXPOSE 8081
CMD ["./auth-service"]
