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
	"github.com/lami-platform/shared/pkg/storage"
	"github.com/lami-platform/services/ticket/internal/application"
	"github.com/lami-platform/services/ticket/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/ticket/internal/interfaces/http"
)

func main() {
	cfg := config.Load("ticket")
	logger.Init("ticket-service")

	logger.Info().Msg("Demarrage Ticket Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	// Repository + annuaire utilisateurs (pour auto-assignation)
	ticketRepo := infrastructure.NewMongoTicketRepository(mongoClient)
	userDirectory := infrastructure.NewHTTPUserDirectory()

	// Service ticket avec auto-assignation
	ticketService := application.NewTicketService(ticketRepo, userDirectory)

	// Stockage fichiers (MinIO ou local)
	store, err := storage.NewFromEnv()
	if err != nil {
		logger.Warn().Err(err).Msg("Stockage fichiers: fallback local ./uploads")
		store, _ = storage.NewLocalStore(storage.Config{
			LocalDir:      "./uploads",
			PublicBaseURL: "/api/v1/tickets/files",
		})
	}

	// Handler HTTP
	handler := httpHandler.NewTicketHandler(ticketService, store)

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Ticket Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		BodyLimit:    12 * 1024 * 1024, // 12 Mo (uploads)
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Ticket Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Ticket Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}