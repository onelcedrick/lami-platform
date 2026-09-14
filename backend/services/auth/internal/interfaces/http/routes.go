package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *AuthHandler, jwtSecret string) {
	api := app.Group("/api/v1/auth")

	api.Get("/health", handler.Health)
	api.Post("/register", handler.Register)
	api.Post("/login", handler.Login)
	api.Post("/refresh", handler.Refresh)
	api.Get("/google", handler.GoogleLogin)
	api.Get("/google/callback", handler.GoogleCallback)
	api.Get("/google/status", handler.GoogleStatus)

	protected := api.Group("", middleware.AuthRequired(jwtSecret))
	protected.Get("/profile", handler.Profile)
}
