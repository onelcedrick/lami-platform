package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/lami-platform/shared/pkg/config"
	"github.com/lami-platform/shared/pkg/logger"
	"github.com/lami-platform/shared/pkg/middleware"
	"github.com/lami-platform/shared/pkg/mongodb"
	"github.com/lami-platform/shared/pkg/rabbitmq"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/services/notification/internal/application"
	"github.com/lami-platform/services/notification/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/notification/internal/interfaces/http"
)

func main() {
	cfg := config.Load("notification")
	logger.Init("notification-service")

	logger.Info().Msg("Demarrage Notification Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	repo := infrastructure.NewMongoNotificationRepository(mongoClient)
	service := application.NewNotificationService(repo)
	handler := httpHandler.NewNotificationHandler(service)

	if rmq, err := rabbitmq.Connect(cfg.RabbitURL); err != nil {
		logger.Warn().Err(err).Msg("RabbitMQ indisponible — notifications evenements off")
	} else {
		defer rmq.Close()
		_ = rmq.Subscribe(events.QueueNotification, []string{
			events.RoutingOrderCreated,
			events.RoutingOrderPaid,
			events.RoutingOrderCancelled,
		}, service.HandleOrderEvent)
	}

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Notification Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Notification Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Notification Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}
