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
	"github.com/lami-platform/services/order/internal/application"
	"github.com/lami-platform/services/order/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/order/internal/interfaces/http"
)

func main() {
	cfg := config.Load("order")
	logger.Init("order-service")

	logger.Info().Msg("Demarrage Order Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	var publisher application.EventPublisher
	rmq, err := rabbitmq.Connect(cfg.RabbitURL)
	if err != nil {
		logger.Warn().Err(err).Msg("RabbitMQ indisponible — evenements desactives")
	} else {
		publisher = rmq
		defer rmq.Close()
		logger.Info().Msg("Publisher RabbitMQ actif (order.created/paid/cancelled)")
	}

	orderRepo := infrastructure.NewMongoOrderRepository(mongoClient)
	catalogClient := infrastructure.NewCatalogClient(cfg.CatalogURL)
	orderService := application.NewOrderService(orderRepo, publisher, catalogClient)
	handler := httpHandler.NewOrderHandler(orderService)

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Order Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Order Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Order Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}
