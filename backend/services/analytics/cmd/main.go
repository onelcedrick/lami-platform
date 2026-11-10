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
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
	"github.com/lami-platform/shared/pkg/metrics"
	"github.com/lami-platform/shared/pkg/middleware"
	"github.com/lami-platform/shared/pkg/mongodb"
	"github.com/lami-platform/shared/pkg/rabbitmq"
	redisclient "github.com/lami-platform/shared/pkg/redis"
	"github.com/lami-platform/services/analytics/internal/application"
	"github.com/lami-platform/services/analytics/internal/infrastructure"
	httpHandler "github.com/lami-platform/services/analytics/internal/interfaces/http"
)

func main() {
	cfg := config.Load("analytics")
	logger.Init("analytics-service")

	logger.Info().Msg("Demarrage Analytics Service...")

	mongoClient, err := mongodb.Connect(cfg.MongoURI, cfg.MongoDBName)
	if err != nil {
		logger.Fatal().Err(err).Msg("Impossible de se connecter a MongoDB")
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = mongoClient.Disconnect(ctx)
	}()

	// Connexions additionnelles pour les KPIs cross-DB
	orderDB := mongoClient.Client.Database("lami_order")
	ticketDB := mongoClient.Client.Database("lami_ticket")
	iaDB := mongoClient.Client.Database("lami_ia")
	analyticsDB := mongoClient.Database

	// Hub SSE + Health + KPI
	hub := application.NewLiveHub()
	healthChecker := application.NewHealthChecker(hub)
	kpiAggregator := application.NewKPIAggregator(analyticsDB, orderDB, ticketDB, iaDB)

	// Connexion Redis (temps reel)
	redisConn, err := redisclient.Connect(cfg.RedisURL)
	if err != nil {
		logger.Warn().Err(err).Msg("Redis indisponible — stats temps reel off")
	}
	if redisConn != nil {
		logger.Info().Msg("Redis connecte (stats temps reel)")
		defer redisConn.Close()
	}

	visitorRepo := infrastructure.NewMongoVisitorRepository(mongoClient)
	activityRepo := infrastructure.NewMongoActivityRepository(mongoClient)
	service := application.NewAnalyticsService(visitorRepo, activityRepo, hub, redisConn)
	handler := httpHandler.NewAnalyticsHandler(service)
	liveHandler := httpHandler.NewLiveHandler(hub, healthChecker, kpiAggregator)

	// Demarre le health checker en background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go healthChecker.Run(ctx)

	if rmq, err := rabbitmq.Connect(cfg.RabbitURL); err != nil {
		logger.Warn().Err(err).Msg("RabbitMQ indisponible - analytics evenements off")
	} else {
		defer rmq.Close()
		_ = rmq.Subscribe(rabbitmq.SubscribeOptions{
			Queue: events.QueueAnalyticsOrders,
			RoutingKeys: []string{
				events.RoutingOrderCreated,
				events.RoutingOrderPaid,
				events.RoutingOrderCancelled,
			},
			Prefetch:     10,
			MaxRetries:   3,
			RetryBackoff: 1 * time.Second,
			Handler:      service.HandleOrderEvent,
		})
	}

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI Analytics Service",
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 0,
	})

	app.Use(recover.New())
	app.Use(metrics.Middleware("analytics"))
	app.Get("/metrics", metrics.Handler)
	app.Use(middleware.SecureCORS())
	app.Use(middleware.RateLimit(cfg.RateLimit))

	httpHandler.SetupRoutes(app, handler, liveHandler, cfg.JWTSecret)

	go func() {
		addr := ":" + cfg.HTTPPort
		logger.Info().Str("port", cfg.HTTPPort).Msg("Analytics Service en ecoute")
		if err := app.Listen(addr); err != nil {
			logger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Arret du Analytics Service...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = app.ShutdownWithContext(shutdownCtx)
}
