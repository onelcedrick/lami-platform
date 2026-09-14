package http

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/analytics/internal/application"
)

type AnalyticsHandler struct {
	service *application.AnalyticsService
}

func NewAnalyticsHandler(service *application.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{service: service}
}

func clientIP(c *fiber.Ctx) string {
	if xff := c.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	return c.IP()
}

func (h *AnalyticsHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Analytics Service operationnel", fiber.Map{
		"service": "analytics",
		"status":  "healthy",
	})
}

// TrackVisit - public (visiteurs hors login)
func (h *AnalyticsHandler) TrackVisit(c *fiber.Ctx) error {
	var req shareddomain.TrackVisitRequest
	if err := c.BodyParser(&req); err != nil || req.VisitorID == "" {
		return response.ValidationError(c, "visitor_id requis")
	}
	stats, err := h.service.TrackVisit(c.Context(), req, clientIP(c), c.Get("User-Agent"))
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Visite enregistree", fiber.Map{
		"date":            stats.Date,
		"unique_visitors": stats.UniqueVisitors,
		"page_views":      stats.PageViews,
	})
}

// LogActivity - authentifie ou public (actions importantes)
func (h *AnalyticsHandler) LogActivity(c *fiber.Ctx) error {
	var req shareddomain.CreateActivityRequest
	if err := c.BodyParser(&req); err != nil || req.Action == "" {
		return response.ValidationError(c, "action requise")
	}
	actorID, _ := c.Locals("userID").(string)
	email, _ := c.Locals("email").(string)
	role, _ := c.Locals("role").(string)

	log, err := h.service.LogActivity(
		c.Context(), req, actorID, email, role, clientIP(c), c.Get("User-Agent"),
	)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Activite journalisee", log)
}

// VisitorSummary - admin
func (h *AnalyticsHandler) VisitorSummary(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "7"))
	summary, err := h.service.VisitorSummary(c.Context(), days)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statistiques visiteurs", summary)
}

// ListActivities - admin
func (h *AnalyticsHandler) ListActivities(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "30"))
	category := c.Query("category")
	actorID := c.Query("actor_id")

	logs, total, err := h.service.ListActivities(c.Context(), page, limit, category, actorID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Journal d'activites", logs, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}
