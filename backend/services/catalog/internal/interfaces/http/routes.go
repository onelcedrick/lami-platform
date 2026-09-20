package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *CatalogHandler, jwtSecret string) {
	api := app.Group("/api/v1/catalog")

	// ============================================================
	// ROUTES PUBLIQUES (pas d'auth)
	// ============================================================
	api.Get("/health", handler.Health)
	api.Get("/products", handler.ListProducts)
	api.Get("/products/popular", handler.ListPopular)
	api.Get("/products/:id", handler.GetProduct)
	api.Get("/products/slug/:slug", handler.GetProductBySlug)
	api.Get("/categories", handler.ListCategories)
	api.Get("/discounts/active", handler.ListActiveDiscounts)   // ✅ reste publique

	// ============================================================
	// ROUTES ADMIN (auth + rôle admin)
	// Groupe dédié avec préfixe vide, middleware explicite
	// ============================================================
	adminMiddleware := []fiber.Handler{
		middleware.AuthRequired(jwtSecret),
		middleware.RoleRequired("admin", "super_admin"),
	}

	// --- Produits (admin) ---
	api.Post("/products", adminMiddleware[0], adminMiddleware[1], handler.CreateProduct)
	api.Post("/products/bulk", adminMiddleware[0], adminMiddleware[1], handler.BulkCreateProducts)
	api.Put("/products/:id", adminMiddleware[0], adminMiddleware[1], handler.UpdateProduct)
	api.Delete("/products/:id", adminMiddleware[0], adminMiddleware[1], handler.DeleteProduct)
	api.Post("/products/:id/sales", adminMiddleware[0], adminMiddleware[1], handler.RecordSale)

	// --- Catégories (admin) ---
	api.Post("/categories", adminMiddleware[0], adminMiddleware[1], handler.CreateCategory)

	// --- Seed (admin) ---
	api.Post("/seed", adminMiddleware[0], adminMiddleware[1], handler.Seed)

	// --- Upload images (admin) ---
	api.Post("/upload", adminMiddleware[0], adminMiddleware[1], handler.UploadImage)
	api.Post("/upload-multiple", adminMiddleware[0], adminMiddleware[1], handler.UploadMultipleImages)

	// --- Promotions (admin) ---
	api.Get("/discounts", adminMiddleware[0], adminMiddleware[1], handler.ListDiscounts)
	api.Post("/discounts", adminMiddleware[0], adminMiddleware[1], handler.CreateDiscount)
	api.Patch("/discounts/:id/toggle", adminMiddleware[0], adminMiddleware[1], handler.ToggleDiscount)
	api.Delete("/discounts/:id", adminMiddleware[0], adminMiddleware[1], handler.DeleteDiscount)
}