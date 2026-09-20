package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *TicketHandler, jwtSecret string) {
	api := app.Group("/api/v1/tickets")

	// ============================================================
	// Middlewares réutilisables (déclarés UNE fois)
	// ============================================================
	authMw := middleware.AuthRequired(jwtSecret)
	techMw := middleware.RoleRequired("technician", "admin", "super_admin")
	adminMw := middleware.RoleRequired("admin", "super_admin")

	// ============================================================
	// Routes PUBLIQUES (aucun middleware)
	// ============================================================
	api.Get("/files/:filename", handler.ServeFile)
	api.Get("/health", handler.Health)

	// ============================================================
	// Routes AUTHENTIFIÉES (client connecté)
	// ============================================================
	api.Post("/", authMw, handler.CreateTicket)
	api.Get("/me", authMw, handler.GetMyTickets)
	api.Post("/upload", authMw, handler.UploadFile)

	// ============================================================
	// Routes TECHNICIEN + ADMIN (avant /:id pour éviter les conflits)
	// ============================================================
	api.Get("/assigned", authMw, techMw, handler.GetAssignedTickets)
	api.Get("/open", authMw, techMw, handler.ListOpenTickets)
	api.Post("/:id/assign", authMw, techMw, handler.AssignTicket)
	api.Patch("/:id/status", authMw, techMw, handler.UpdateStatus)

	// ============================================================
	// Routes ADMIN uniquement
	// ============================================================
	api.Get("/", authMw, adminMw, handler.ListTickets)

	// ============================================================
	// Routes PARAMÉTRÉES en DERNIER (sinon "open"/"assigned" matchent :id)
	// ============================================================
	api.Get("/:id", authMw, handler.GetTicket)
	api.Post("/:id/messages", authMw, handler.AddMessage)
	api.Get("/:id/stream", authMw, handler.StreamMessages)
}