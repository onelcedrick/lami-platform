package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/middleware"
)

func SetupRoutes(app *fiber.App, handler *UserHandler, jwtSecret string) {
	api := app.Group("/api/v1/users")

	api.Get("/health", handler.Health)
	api.Get("/geo/regions", handler.ListRegions) // public GEO data
	api.Get("/settings/shop", handler.GetShopSettings) // public lecture

	protected := api.Group("", middleware.AuthRequired(jwtSecret))
	protected.Get("/me", handler.GetProfile)
	protected.Put("/me", handler.UpdateProfile)
	protected.Get("/me/cart", handler.GetCart)
	protected.Put("/me/cart", handler.SaveCart)
	protected.Get("/me/favorites", handler.GetFavorites)
	protected.Put("/me/favorites", handler.SaveFavorites)

	admin := api.Group("", middleware.AuthRequired(jwtSecret), middleware.RoleRequired("admin", "super_admin"))
	admin.Get("/", handler.ListUsers)
	admin.Get("/stats", handler.Stats)
	admin.Get("/:id", handler.GetUser)
	admin.Put("/:id", handler.AdminUpdateUser)
	admin.Post("/:id/deactivate", handler.DeactivateUser)
	admin.Put("/settings/shop", handler.UpdateShopSettings)
}
