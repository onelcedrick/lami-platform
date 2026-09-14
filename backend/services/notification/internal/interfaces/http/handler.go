package http

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/notification/internal/application"
)

type NotificationHandler struct {
	service *application.NotificationService
}

func NewNotificationHandler(service *application.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

func (h *NotificationHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Notification Service operationnel", fiber.Map{
		"service": "notification",
		"status":  "healthy",
	})
}

func (h *NotificationHandler) Create(c *fiber.Ctx) error {
	var req shareddomain.CreateNotificationRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	if req.UserID == "" || req.Title == "" || req.Body == "" || req.Type == "" {
		return response.ValidationError(c, "user_id, type, title et body sont obligatoires")
	}

	n, err := h.service.Create(c.Context(), req)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Notification creee", n)
}

func (h *NotificationHandler) GetMyNotifications(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	unreadOnly := c.Query("unread") == "true"

	list, total, err := h.service.GetUserNotifications(c.Context(), userID, page, limit, unreadOnly)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Notifications recuperees", list, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}
	id := c.Params("id")

	if err := h.service.MarkAsRead(c.Context(), id, userID); err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Notification marquee comme lue", nil)
}

func (h *NotificationHandler) MarkAllAsRead(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	if err := h.service.MarkAllAsRead(c.Context(), userID); err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Toutes les notifications marquees comme lues", nil)
}

func (h *NotificationHandler) CountUnread(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	count, err := h.service.CountUnread(c.Context(), userID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Compteur non lus", fiber.Map{"unread": count})
}
