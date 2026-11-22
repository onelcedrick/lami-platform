package http

import (
	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/services/catalog/internal/application"
	"github.com/lami-platform/services/catalog/internal/domain"
	"github.com/lami-platform/shared/pkg/response"
)

type ReviewHandler struct {
	service *application.ReviewService
}

func NewReviewHandler(service *application.ReviewService) *ReviewHandler {
	return &ReviewHandler{service: service}
}

func (h *ReviewHandler) ListReviews(c *fiber.Ctx) error {
	productID := c.Params("id")
	reviews, err := h.service.GetReviews(c.Context(), productID)
	if err != nil {
		return response.InternalError(c, "Impossible de récupérer les avis")
	}
	return response.Success(c, fiber.StatusOK, "Avis récupérés avec succès", reviews)
}

func (h *ReviewHandler) CreateReview(c *fiber.Ctx) error {
	productID := c.Params("id")
	
	// Récupération de l'ID utilisateur depuis le middleware d'authentification
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return response.Unauthorized(c, "Utilisateur non authentifié")
	}
	
	var body struct {
		Rating   int    `json:"rating"`
		Comment  string `json:"comment"`
		UserName string `json:"user_name"`
	}
	
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "Données invalides")
	}

	review := &domain.Review{
		ProductID: productID,
		UserID:    userID,
		UserName:  body.UserName,
		Rating:    body.Rating,
		Comment:   body.Comment,
	}

	if err := h.service.AddReview(c.Context(), review); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}

	return response.Success(c, fiber.StatusCreated, "Avis créé avec succès", review)
}
