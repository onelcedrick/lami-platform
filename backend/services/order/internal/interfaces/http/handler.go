package http

import (
	"os"
	"strconv"

	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/order/internal/application"
)

type OrderHandler struct {
	service *application.OrderService
}

func NewOrderHandler(service *application.OrderService) *OrderHandler {
	return &OrderHandler{service: service}
}

func (h *OrderHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Order Service operationnel", fiber.Map{
		"service": "order",
		"status":  "healthy",
	})
}

func (h *OrderHandler) CreateOrder(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	var req shareddomain.CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	if len(req.Items) == 0 {
		return response.ValidationError(c, "Au moins un article est requis")
	}
	if req.PaymentMethod == "" {
		return response.ValidationError(c, "Methode de paiement requise")
	}

	order, err := h.service.CreateOrder(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Commande creee", order)
}

func (h *OrderHandler) GetOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	order, err := h.service.GetOrder(c.Context(), id)
	if err != nil {
		return response.NotFound(c, err.Error())
	}

	userID, _ := c.Locals("userID").(string)
	role, _ := c.Locals("role").(string)
	if role != "admin" && role != "super_admin" && order.UserID != userID {
		return response.Forbidden(c, "Acces refuse")
	}
	return response.Success(c, fiber.StatusOK, "Commande recuperee", order)
}

func (h *OrderHandler) GetMyOrders(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	orders, total, err := h.service.GetUserOrders(c.Context(), userID, page, limit)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Commandes recuperees", orders, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *OrderHandler) ListOrders(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status")

	orders, total, err := h.service.ListOrders(c.Context(), page, limit, status)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Commandes recuperees", orders, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *OrderHandler) UpdateStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		Status        shareddomain.OrderStatus   `json:"status"`
		PaymentStatus shareddomain.PaymentStatus `json:"payment_status"`
	}
	if err := c.BodyParser(&body); err != nil || body.Status == "" {
		return response.ValidationError(c, "Statut requis")
	}

	order, err := h.service.UpdateStatus(c.Context(), id, body.Status, body.PaymentStatus)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statut mis a jour", order)
}

func (h *OrderHandler) CancelOrder(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}
	id := c.Params("id")

	order, err := h.service.CancelOrder(c.Context(), id, userID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Commande annulee", order)
}

func (h *OrderHandler) PayOrder(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	id := c.Params("id")
	var body struct {
		Method string `json:"method"`
		Phone  string `json:"phone"`
	}
	if err := c.BodyParser(&body); err != nil || body.Method == "" {
		return response.ValidationError(c, "Methode de paiement requise")
	}
	order, err := h.service.PayOrder(c.Context(), id, userID, body.Method, body.Phone)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Paiement initie", order)
}

func (h *OrderHandler) GetStats(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	stats, err := h.service.GetStats(c.Context(), days)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statistiques commandes", stats)
}

func (h *OrderHandler) PaymentWebhook(c *fiber.Ctx) error {
	// Securite: header X-Webhook-Secret
	secret := c.Get("X-Webhook-Secret")
	expected := c.Get("X-Expected") // unused
	_ = expected
	envSecret := os.Getenv("MOMO_WEBHOOK_SECRET")
	if envSecret == "" {
		envSecret = "lami-momo-webhook-dev"
	}
	if secret != envSecret {
		return response.Unauthorized(c, "Webhook secret invalide")
	}
	var body struct {
		OrderID     string `json:"order_id"`
		OrderNumber string `json:"order_number"`
		Status      string `json:"status"` // success | failed
		ProviderRef string `json:"provider_ref"`
		Operator    string `json:"operator"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	id := body.OrderID
	if id == "" {
		id = body.OrderNumber
	}
	if id == "" {
		return response.ValidationError(c, "order_id ou order_number requis")
	}
	status := body.Status
	if status == "" {
		status = "success"
	}
	order, err := h.service.ConfirmPayment(c.Context(), id, body.ProviderRef, status)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Paiement traite", order)
}

// SimulateOperatorConfirm — endpoint admin/dev pour simuler callback operateur
func (h *OrderHandler) SimulateOperatorConfirm(c *fiber.Ctx) error {
	id := c.Params("id")
	order, err := h.service.ConfirmPayment(c.Context(), id, "SIM-"+id[:8], "success")
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Paiement simule confirme", order)
}

func (h *OrderHandler) GetInvoice(c *fiber.Ctx) error {
	id := c.Params("id")
	inv, err := h.service.GetInvoice(c.Context(), id)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Facture", inv)
}

func (h *OrderHandler) GetInvoicePDF(c *fiber.Ctx) error {
	id := c.Params("id")
	data, filename, err := h.service.BuildInvoicePDF(c.Context(), id)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", "attachment; filename="+filename)
	return c.Send(data)
}
