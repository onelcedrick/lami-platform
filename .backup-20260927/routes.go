package http

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/jwt"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *AnalyticsHandler, jwtSecret string) {
	api := app.Group("/api/v1/analytics")

	api.Get("/health", handler.Health)

	// Public : tracking visiteurs anonymes (hors login)
	api.Post("/visit", handler.TrackVisit)

	// Journalisation (auth optionnelle)
	api.Post("/events", softAuth(jwtSecret), handler.LogActivity)

	// Admin uniquement
	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Get("/visitors", handler.VisitorSummary)
	admin.Get("/events", handler.ListActivities)
}

func softAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Next()
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Next()
		}
		claims, err := jwt.ValidateToken(parts[1], secret)
		if err != nil {
			return c.Next()
		}
		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}
