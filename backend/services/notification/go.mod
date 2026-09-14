module github.com/lami-platform/services/notification

go 1.22

require (
	github.com/gofiber/fiber/v2 v2.52.5
	github.com/google/uuid v1.6.0
	github.com/lami-platform/shared v0.0.0
	go.mongodb.org/mongo-driver v1.17.1
)

replace github.com/lami-platform/shared => ../../shared
