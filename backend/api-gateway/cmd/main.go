package main

import (
	"bufio"
	"bytes"
	"context"
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

	// -------------------------------------------------------------------------
	// Auth — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/auth/*", proxyHandler(authURL))
	app.All("/api/v1/auth", proxyHandler(authURL))

	// -------------------------------------------------------------------------
	// Users / Profile / GEO — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/users/*", proxyHandler(userURL))
	app.All("/api/v1/users", proxyHandler(userURL))

	// -------------------------------------------------------------------------
	// Catalog — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/catalog/*", proxyHandler(catalogURL))
	app.All("/api/v1/catalog", proxyHandler(catalogURL))

	// -------------------------------------------------------------------------
	// Orders — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/orders/*", proxyHandler(orderURL))
	app.All("/api/v1/orders", proxyHandler(orderURL))

	// -------------------------------------------------------------------------
	// Tickets — SSE stream (PAS de buffer, AVANT le wildcard)
	// ⚠️ L'ordre est CRITIQUE : cette route doit être déclarée AVANT
	//    la route wildcard /api/v1/tickets/*, sinon elle ne matchera jamais.
	// -------------------------------------------------------------------------
	app.Get("/api/v1/tickets/:id/stream", streamProxyHandler(ticketURL))

	// Tickets — proxy classique
	app.All("/api/v1/tickets/*", proxyHandler(ticketURL))
	app.All("/api/v1/tickets", proxyHandler(ticketURL))

	// -------------------------------------------------------------------------
	// Notifications — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/notifications/*", proxyHandler(notifURL))
	app.All("/api/v1/notifications", proxyHandler(notifURL))

	// -------------------------------------------------------------------------
	// IA Service — proxy transparent
	// -------------------------------------------------------------------------
	app.All("/api/v1/ia/*", proxyHandler(iaURL))
	app.All("/api/v1/ia", proxyHandler(iaURL))

	// -------------------------------------------------------------------------
	// Analytics (visiteurs + logs) — proxy transparent
	// -------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Proxy handler — transmet la requête et la réponse telles quelles
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// streamProxyHandler — proxy SSE (streaming réel, sans buffer)
//
// Le proxyHandler classique bufferise la réponse avec io.ReadAll,
// ce qui casse les Server-Sent Events (le stream ne se termine jamais).
//
// Ce handler streame la réponse au fur et à mesure, sans buffer,
// et n'applique PAS de timeout (les SSE peuvent durer longtemps).
// -----------------------------------------------------------------------------
func streamProxyHandler(targetBase string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()
		query := string(c.Request().URI().QueryString())
		target := targetBase + path
		if query != "" {
			target += "?" + query
		}

		// Contexte détaché (survit à la requête entrante Fiber)
		req, err := http.NewRequestWithContext(context.Background(), c.Method(), target, nil)
		if err != nil {
			return response.InternalError(c, "Erreur de construction de la requete")
		}

		// Copier tous les headers (Authorization, Accept, etc.)
		c.Request().Header.VisitAll(func(key, value []byte) {
			k := string(key)
			if !strings.EqualFold(k, "Host") && !strings.EqualFold(k, "Connection") {
				req.Header.Set(k, string(value))
			}
		})

		// ⚠️ Client HTTP SANS timeout — le SSE peut durer plusieurs minutes
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			applogger.Error().Err(err).Str("target", target).Msg("Erreur proxy SSE")
			return response.InternalError(c, "Service temporairement indisponible")
		}

		// ⚠️ PAS de defer ici — le body est fermé par le StreamWriter ci-dessous

		// Copier les headers de réponse (Content-Type: text/event-stream, etc.)
		for k, vals := range resp.Header {
			for _, v := range vals {
				c.Set(k, v)
			}
		}

		// ✅ SetBodyStreamWriter = Fiber gère le streaming correctement
		// Le defer resp.Body.Close() est INSIDE, donc il se déclenche à la
		// fin du stream (pas avant).
		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			defer resp.Body.Close()

			buf := make([]byte, 4096)
			for {
				n, err := resp.Body.Read(buf)
				if n > 0 {
					if _, werr := w.Write(buf[:n]); werr != nil {
						return
					}
					if ferr := w.Flush(); ferr != nil {
						return
					}
				}
				if err != nil {
					return
				}
			}
		})

		c.Status(resp.StatusCode)
		return nil
	}
}