package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *OrderHandler, jwtSecret string) {
	api := app.Group("/api/v1/orders")

	api.Get("/health", handler.Health)
	api.Post("/webhooks/mobile-money", handler.PaymentWebhook)

	protected := api.Group("", middleware.AuthRequired(jwtSecret))
	protected.Post("/", handler.CreateOrder)
	protected.Get("/me", handler.GetMyOrders)
	protected.Get("/:id", handler.GetOrder)
	protected.Post("/:id/cancel", handler.CancelOrder)
	protected.Post("/:id/pay", handler.PayOrder)
	protected.Get("/:id/invoice", handler.GetInvoice)
	protected.Get("/:id/invoice.pdf", handler.GetInvoicePDF)

	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Get("/stats", handler.GetStats)
	admin.Get("/:id/invoice", handler.GetInvoice)
	admin.Get("/:id/invoice.pdf", handler.GetInvoicePDF)
	admin.Post("/:id/confirm-payment", handler.SimulateOperatorConfirm)
	admin.Get("/", handler.ListOrders)
	admin.Patch("/:id/status", handler.UpdateStatus)
}
