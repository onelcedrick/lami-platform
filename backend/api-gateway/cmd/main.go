package main

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/lami-platform/shared/pkg/config"
	applogger "github.com/lami-platform/shared/pkg/logger"
	"github.com/lami-platform/shared/pkg/middleware"
	"github.com/lami-platform/shared/pkg/metrics"
	"github.com/lami-platform/shared/pkg/response"
)

func main() {
	cfg := config.Load("gateway")
	applogger.Init("api-gateway")

	applogger.Info().Msg("Demarrage API Gateway...")

	app := fiber.New(fiber.Config{
		AppName:      "L'AMI API Gateway",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		BodyLimit:    10 * 1024 * 1024,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} (${latency})\n",
	}))
	app.Use(middleware.SecureCORS())
	app.Use(metrics.Middleware("gateway"))
	app.Use(middleware.RateLimit(cfg.RateLimit))
	app.Use(limiter.New(limiter.Config{
		Max:        cfg.RateLimit,
		Expiration: 1 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return response.Error(c, fiber.StatusTooManyRequests, "Trop de requetes. Veuillez reessayer plus tard.")
		},
	}))

	app.Get("/metrics", metrics.Handler)

	app.Get("/health", func(c *fiber.Ctx) error {
		return response.Success(c, fiber.StatusOK, "API Gateway operationnel", fiber.Map{
			"service": "api-gateway",
			"status":  "healthy",
			"version": "1.0.0",
		})
	})

	// Proxy routes
	authURL := cfg.AuthServiceURL
	userURL := cfg.UserServiceURL
	catalogURL := cfg.CatalogURL
	orderURL := cfg.OrderServiceURL
	ticketURL := cfg.TicketServiceURL
	notifURL := cfg.NotifServiceURL
	iaURL := cfg.IAServiceURL
	analyticsURL := cfg.AnalyticsURL

	// Auth
	app.All("/api/v1/auth/*", proxyHandler(authURL))

	// Users / Profile / GEO
	app.All("/api/v1/users/*", proxyHandler(userURL))
	app.All("/api/v1/users", proxyHandler(userURL))

	// Catalog public
	app.Get("/api/v1/catalog/products", proxyHandler(catalogURL))
	app.Get("/api/v1/catalog/products/*", proxyHandler(catalogURL))
	app.Get("/api/v1/catalog/categories", proxyHandler(catalogURL))
	app.Get("/api/v1/catalog/health", proxyHandler(catalogURL))

	// Catalog admin
	adminCatalog := app.Group("/api/v1/catalog", middleware.AuthRequired(cfg.JWTSecret), middleware.RoleRequired("admin", "super_admin"))
	adminCatalog.All("/*", proxyHandler(catalogURL))

	// Orders (JWT required - le service valide aussi)
	app.All("/api/v1/orders/*", proxyHandler(orderURL))
	app.All("/api/v1/orders", proxyHandler(orderURL))

	// Tickets
	app.All("/api/v1/tickets/*", proxyHandler(ticketURL))
	app.All("/api/v1/tickets", proxyHandler(ticketURL))

	// Notifications
	app.All("/api/v1/notifications/*", proxyHandler(notifURL))
	app.All("/api/v1/notifications", proxyHandler(notifURL))

	// IA Service
	app.All("/api/v1/ia/*", proxyHandler(iaURL))
	app.All("/api/v1/ia", proxyHandler(iaURL))

	// Analytics (visiteurs + logs)
	app.All("/api/v1/analytics/*", proxyHandler(analyticsURL))
	app.All("/api/v1/analytics", proxyHandler(analyticsURL))

	// Catch-all
	app.All("/*", func(c *fiber.Ctx) error {
		return response.NotFound(c, "Route non trouvee. Consultez la documentation API.")
	})

	go func() {
		addr := ":" + cfg.HTTPPort
		applogger.Info().Str("port", cfg.HTTPPort).Msg("API Gateway en ecoute")
		if err := app.Listen(addr); err != nil {
			applogger.Fatal().Err(err).Msg("Erreur serveur HTTP")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	applogger.Info().Msg("Arret de l'API Gateway...")
	_ = app.Shutdown()
}

func proxyHandler(targetBase string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()
		query := string(c.Request().URI().QueryString())
		target := targetBase + path
		if query != "" {
			target += "?" + query
		}

		var body io.Reader
		if c.Method() != http.MethodGet && c.Method() != http.MethodHead {
			body = bytes.NewReader(c.Body())
		}

		req, err := http.NewRequestWithContext(c.Context(), c.Method(), target, body)
		if err != nil {
			return response.InternalError(c, "Erreur de construction de la requete")
		}

		c.Request().Header.VisitAll(func(key, value []byte) {
			k := string(key)
			if !strings.EqualFold(k, "Host") && !strings.EqualFold(k, "Connection") {
				req.Header.Set(k, string(value))
			}
		})

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			applogger.Error().Err(err).Str("target", target).Msg("Erreur proxy")
			return response.InternalError(c, "Service temporairement indisponible")
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return response.InternalError(c, "Erreur de lecture de la reponse")
		}

		for k, vals := range resp.Header {
			for _, v := range vals {
				c.Set(k, v)
			}
		}

		return c.Status(resp.StatusCode).Send(respBody)
	}
}
