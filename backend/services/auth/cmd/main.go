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
	"github.com/lami-platform/services/auth/internal/application"
	"github.com/lami-platform/services/auth/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/auth/internal/interfaces/http"
)

func main() {
	cfg := config.Load("auth")
	logger.Init("auth-service")

	logger.Info().Msg("Demarrage Auth Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	userRepo := infrastructure.NewMongoUserRepository(mongoClient)
	authService := application.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiration)
	application.SetGlobalOAuthConfig(application.OAuthConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURI:  cfg.GoogleRedirectURI,
		FrontendURL:  cfg.FrontendURL,
	})
	handler := httpHandler.NewAuthHandler(authService)

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Auth Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})

	app.Use(recover.New())
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Auth Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Auth Service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = app.ShutdownWithContext(ctx)
}
