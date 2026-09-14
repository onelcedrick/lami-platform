package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/config"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
	"github.com/lami-platform/shared/pkg/middleware"
	"github.com/lami-platform/shared/pkg/mongodb"
	"github.com/lami-platform/shared/pkg/rabbitmq"
	"github.com/lami-platform/shared/pkg/storage"
	"github.com/lami-platform/services/catalog/internal/application"
	"github.com/lami-platform/services/catalog/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/catalog/internal/interfaces/http"
)

func main() {
	cfg := config.Load("catalog")
	logger.Init("catalog-service")

	logger.Info().Msg("Demarrage Catalog Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	productRepo := infrastructure.NewMongoProductRepository(mongoClient)
	categoryRepo := infrastructure.NewMongoCategoryRepository(mongoClient)
	discountRepo := infrastructure.NewMongoDiscountRepository(mongoClient)
	catalogService := application.NewCatalogService(productRepo, categoryRepo, discountRepo)

	// ✅ Object store (local ou MinIO selon l'env)
	store, err := storage.NewFromEnv()
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible d'initialiser l'object store")
	}
	logger.Info().Msg("Object store initialise")

	handler := httpHandler.NewCatalogHandler(catalogService, store)

	// Consumer evenements commande → stock / ventes
	if rmq, err := rabbitmq.Connect(cfg.RabbitURL); err != nil {
		logger.Warn().Err(err).Msg("RabbitMQ indisponible — stock non synchro auto")
	} else {
		defer rmq.Close()
		_ = rmq.Subscribe(events.QueueCatalogStock, []string{
			events.RoutingOrderCreated,
			events.RoutingOrderPaid,
			events.RoutingOrderCancelled,
		}, catalogService.HandleOrderEvent)
	}

	// Seed automatique au demarrage (dev)
	go func() {
		time.Sleep(2 * time.Second)

		// Catégories : idempotent par slug (déjà géré dans SeedCategories)
		_ = catalogService.SeedCategories(context.Background())

		// ✅ Garde-fou : ne seeder les produits que si la base est vide
		_, total, err := catalogService.ListProducts(
			context.Background(),
			shareddomain.ProductFilter{Page: 1, Limit: 1},
		)
		if err == nil && total == 0 {
			_ = catalogService.SeedSampleProducts(context.Background())
			logger.Info().Msg("Donnees de demonstration chargees (base vide)")
		} else {
			logger.Info().
				Int64("existing_products", total).
				Msg("Seed ignore (produits deja presents)")
		}
	}()

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Catalog Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Catalog Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Catalog Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}
