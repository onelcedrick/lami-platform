package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *NotificationHandler, jwtSecret string) {
	api := app.Group("/api/v1/notifications")

	api.Get("/health", handler.Health)

	// Creation interne (services) - protege par JWT admin ou appel service-to-service
	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Post("/", handler.Create)

	protected := api.Group("", middleware.AuthRequired(jwtSecret))
	protected.Get("/me", handler.GetMyNotifications)
	protected.Get("/unread-count", handler.CountUnread)
	protected.Patch("/:id/read", handler.MarkAsRead)
	protected.Post("/read-all", handler.MarkAllAsRead)
}
