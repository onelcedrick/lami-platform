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
	"github.com/lami-platform/services/user/internal/application"
	"github.com/lami-platform/services/user/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/user/internal/interfaces/http"
)

func main() {
	cfg := config.Load("user")
	logger.Init("user-service")

	logger.Info().Msg("Demarrage User Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	// Partage la meme collection users que Auth (lami_auth) en production.
	// En dev, on peut pointer MONGO_DB=lami_auth pour unifier.
	repo := infrastructure.NewMongoUserRepository(mongoClient)
	service := application.NewUserService(repo)
	handler := httpHandler.NewUserHandler(service)

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI User Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("User Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du User Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}
