package http

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/user/internal/application"
)

type UserHandler struct {
	service *application.UserService
}

func NewUserHandler(service *application.UserService) *UserHandler {
	return &UserHandler{service: service}
}

func (h *UserHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "User Service operationnel", fiber.Map{
		"service": "user",
		"status":  "healthy",
	})
}

func (h *UserHandler) GetProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	user, err := h.service.GetProfile(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Profil recupere", user)
}

func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var req shareddomain.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	user, err := h.service.UpdateProfile(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Profil mis a jour", user)
}

func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	role := c.Query("role")
	search := c.Query("search")
	var activeOnly *bool
	if a := c.Query("active"); a == "true" {
		t := true
		activeOnly = &t
	} else if a == "false" {
		f := false
		activeOnly = &f
	}

	users, total, err := h.service.ListUsers(c.Context(), page, limit, role, search, activeOnly)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Utilisateurs recuperes", users, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *UserHandler) GetUser(c *fiber.Ctx) error {
	user, err := h.service.GetUser(c.Context(), c.Params("id"))
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur recupere", user)
}

func (h *UserHandler) AdminUpdateUser(c *fiber.Ctx) error {
	var req shareddomain.AdminUpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	user, err := h.service.AdminUpdateUser(c.Context(), c.Params("id"), req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur mis a jour", user)
}

func (h *UserHandler) DeactivateUser(c *fiber.Ctx) error {
	if err := h.service.DeactivateUser(c.Context(), c.Params("id")); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur desactive", nil)
}

func (h *UserHandler) Stats(c *fiber.Ctx) error {
	stats, err := h.service.Stats(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statistiques utilisateurs", stats)
}

func (h *UserHandler) ListRegions(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Regions Madagascar", h.service.ListRegions())
}

func (h *UserHandler) GetCart(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	items, err := h.service.GetCart(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Panier", items)
}

func (h *UserHandler) SaveCart(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var body struct {
		Items []shareddomain.UserCartItem `json:"items"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	items, err := h.service.SaveCart(c.Context(), userID, body.Items)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Panier enregistre", items)
}

func (h *UserHandler) GetFavorites(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	items, err := h.service.GetFavorites(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Favoris", items)
}

func (h *UserHandler) SaveFavorites(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var body struct {
		Items []shareddomain.UserFavoriteItem `json:"items"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	items, err := h.service.SaveFavorites(c.Context(), userID, body.Items)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Favoris enregistres", items)
}

func (h *UserHandler) GetShopSettings(c *fiber.Ctx) error {
	st, err := h.service.GetShopSettings(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Parametres boutique", st)
}

func (h *UserHandler) UpdateShopSettings(c *fiber.Ctx) error {
	var body shareddomain.ShopSettings
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	st, err := h.service.UpdateShopSettings(c.Context(), &body)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Parametres enregistres", st)
}
