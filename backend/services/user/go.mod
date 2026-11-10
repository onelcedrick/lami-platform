module github.com/lami-platform/services/user

go 1.22

require (
	github.com/gofiber/fiber/v2 v2.52.5
	github.com/lami-platform/shared v0.0.0
	go.mongodb.org/mongo-driver v1.17.1
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/redis/go-redis/v9 v9.7.0 // indirect
)

replace github.com/lami-platform/shared => ../../shared
