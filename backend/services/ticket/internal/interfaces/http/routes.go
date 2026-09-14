package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *TicketHandler, jwtSecret string) {
	api := app.Group("/api/v1/tickets")

	// Fichiers publics (lecture images/PDF)
	api.Get("/files/:filename", handler.ServeFile)
	api.Get("/health", handler.Health)

	protected := api.Group("", middleware.AuthRequired(jwtSecret))
	protected.Post("/", handler.CreateTicket)
	protected.Get("/me", handler.GetMyTickets)
	protected.Post("/upload", handler.UploadFile)

	// IMPORTANT: routes fixes AVANT /:id sinon "open"/"assigned" matchent GetTicket
	tech := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("technician", "admin", "super_admin"))
	tech.Get("/assigned", handler.GetAssignedTickets)
	tech.Get("/open", handler.ListOpenTickets)
	tech.Post("/:id/assign", handler.AssignTicket)

	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Get("/", handler.ListTickets)

	// Parametriques en dernier
	protected.Get("/:id", handler.GetTicket)
	protected.Patch("/:id/status", handler.UpdateStatus)
	protected.Post("/:id/messages", handler.AddMessage)
	protected.Get("/:id/stream", handler.StreamMessages)
}