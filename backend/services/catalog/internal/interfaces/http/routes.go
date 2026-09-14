package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *CatalogHandler, jwtSecret string) {
	api := app.Group("/api/v1/catalog")

	api.Get("/health", handler.Health)
	api.Get("/products", handler.ListProducts)
	api.Get("/products/popular", handler.ListPopular)
	api.Get("/products/:id", handler.GetProduct)
	api.Get("/products/slug/:slug", handler.GetProductBySlug)
	api.Get("/categories", handler.ListCategories)
	api.Get("/discounts/active", handler.ListActiveDiscounts)

	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Post("/products", handler.CreateProduct)
	admin.Post("/products/bulk", handler.BulkCreateProducts)
	admin.Put("/products/:id", handler.UpdateProduct)
	admin.Delete("/products/:id", handler.DeleteProduct)
	admin.Post("/categories", handler.CreateCategory)
	admin.Post("/seed", handler.Seed)
	admin.Post("/products/:id/sales", handler.RecordSale)

	admin.Get("/discounts", handler.ListDiscounts)
	admin.Post("/discounts", handler.CreateDiscount)
	admin.Patch("/discounts/:id/toggle", handler.ToggleDiscount)
	admin.Delete("/discounts/:id", handler.DeleteDiscount)
}
