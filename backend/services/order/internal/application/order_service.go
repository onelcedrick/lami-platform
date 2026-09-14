package application

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/pdf"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/services/order/internal/domain"
)

type EventPublisher interface {
	Publish(ctx context.Context, routingKey string, payload any) error
}

// CatalogPricer charge prix officiels + promos actives (source de verite serveur)
type CatalogPricer interface {
	GetProduct(ctx context.Context, productID string) (*shareddomain.Product, error)
	ListActiveDiscounts(ctx context.Context) ([]shareddomain.Discount, error)
}

type OrderService struct {
	orderRepo domain.OrderRepository
	publisher EventPublisher // optional — nil = no events
	catalog   CatalogPricer  // optional — si nil, refus des commandes (fail-closed)
}

func NewOrderService(orderRepo domain.OrderRepository, publisher EventPublisher, catalog CatalogPricer) *OrderService {
	return &OrderService{orderRepo: orderRepo, publisher: publisher, catalog: catalog}
}

func (s *OrderService) itemsToEvents(items []shareddomain.OrderItem) []events.OrderItemEvent {
	out := make([]events.OrderItemEvent, 0, len(items))
	for _, it := range items {
		out = append(out, events.OrderItemEvent{
			ProductID:   it.ProductID,
			ProductName: it.ProductName,
			SKU:         it.SKU,
			Quantity:    it.Quantity,
			UnitPrice:   it.UnitPrice,
		})
	}
	return out
}

func (s *OrderService) publish(ctx context.Context, key string, payload any) {
	if s.publisher == nil {
		return
	}
	if err := s.publisher.Publish(ctx, key, payload); err != nil {
		// Log only — la commande est deja persistee (outbox pattern ideal en prod)
		fmt.Printf("[order] publish %s failed: %v\n", key, err)
	}
}

func generateOrderNumber() string {
	return fmt.Sprintf("ORD-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:8])
}

func (s *OrderService) CreateOrder(ctx context.Context, userID string, req shareddomain.CreateOrderRequest) (*shareddomain.Order, error) {
	if len(req.Items) == 0 {
		return nil, errors.New("la commande doit contenir au moins un article")
	}
	if s.catalog == nil {
		return nil, errors.New("service catalogue indisponible — impossible de valider les prix")
	}

	discounts, _ := s.catalog.ListActiveDiscounts(ctx)

	var items []shareddomain.OrderItem
	var subTotal float64
	var totalDiscount float64

	for _, itemReq := range req.Items {
		if itemReq.Quantity <= 0 {
			return nil, errors.New("quantite invalide")
		}

		// SOURCE DE VERITE : prix catalogue serveur (ignore unit_price client)
		product, err := s.catalog.GetProduct(ctx, itemReq.ProductID)
		if err != nil {
			return nil, fmt.Errorf("produit %s: %w", itemReq.ProductID, err)
		}
		if product.Status != "" && product.Status != shareddomain.ProductStatusActive {
			return nil, fmt.Errorf("produit indisponible: %s", product.Name)
		}
		if product.Stock < itemReq.Quantity {
			return nil, fmt.Errorf("stock insuffisant pour %s (dispo: %d)", product.Name, product.Stock)
		}

		unitPrice, lineDisc := resolvePrice(product, discounts)
		lineTotal := unitPrice * float64(itemReq.Quantity)
		totalDiscount += lineDisc * float64(itemReq.Quantity)

		name := product.Name
		sku := product.SKU
		img := ""
		if len(product.Images) > 0 {
			img = product.Images[0]
		}

		items = append(items, shareddomain.OrderItem{
			ProductID:   product.ID,
			ProductName: name,
			SKU:         sku,
			Quantity:    itemReq.Quantity,
			UnitPrice:   unitPrice,
			TotalPrice:  lineTotal,
			ImageURL:    img,
		})
		subTotal += lineTotal
	}

	shippingCost := 0.0
	if subTotal > 0 && subTotal < 500000 {
		shippingCost = 10000
	}
	tax := 0.0
	total := subTotal + shippingCost + tax

	now := time.Now().UTC()
	order := &shareddomain.Order{
		ID:              uuid.New().String(),
		OrderNumber:     generateOrderNumber(),
		UserID:          userID,
		Items:           items,
		SubTotal:        subTotal,
		ShippingCost:    shippingCost,
		Tax:             tax,
		Discount:        totalDiscount,
		Total:           total,
		Status:          shareddomain.OrderStatusPending,
		PaymentStatus:   shareddomain.PaymentStatusPending,
		PaymentMethod:   req.PaymentMethod,
		ShippingAddress: req.ShippingAddress,
		BillingAddress:  req.BillingAddress,
		Notes:           req.Notes,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.orderRepo.Create(ctx, order); err != nil {
		return nil, err
	}

	s.publish(ctx, events.RoutingOrderCreated, events.OrderCreatedEvent{
		EventID:       uuid.New().String(),
		OccurredAt:    now,
		OrderID:       order.ID,
		OrderNumber:   order.OrderNumber,
		UserID:        userID,
		Items:         s.itemsToEvents(order.Items),
		Total:         order.Total,
		Currency:      "MGA",
		PaymentMethod: order.PaymentMethod,
	})
	return order, nil
}

func resolvePrice(product *shareddomain.Product, discounts []shareddomain.Discount) (unit float64, discountPerUnit float64) {
	base := product.Price
	best := base
	for i := range discounts {
		d := &discounts[i]
		if !d.IsActive {
			continue
		}
		ok := false
		switch d.Target {
		case shareddomain.DiscountTargetGlobal:
			ok = true
		case shareddomain.DiscountTargetCategory:
			ok = d.TargetID == product.CategoryID
		case shareddomain.DiscountTargetProduct:
			ok = d.TargetID == product.ID
		}
		if !ok {
			continue
		}
		p := shareddomain.ApplyDiscount(base, d)
		if p < best {
			best = p
		}
	}
	return best, base - best
}

func (s *OrderService) GetOrder(ctx context.Context, id string) (*shareddomain.Order, error) {
	return s.orderRepo.FindByID(ctx, id)
}

func (s *OrderService) GetOrderByNumber(ctx context.Context, orderNumber string) (*shareddomain.Order, error) {
	return s.orderRepo.FindByOrderNumber(ctx, orderNumber)
}

func (s *OrderService) GetUserOrders(ctx context.Context, userID string, page, limit int) ([]shareddomain.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.orderRepo.FindByUserID(ctx, userID, page, limit)
}

func (s *OrderService) ListOrders(ctx context.Context, page, limit int, status string) ([]shareddomain.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.orderRepo.List(ctx, page, limit, status)
}

func (s *OrderService) UpdateStatus(ctx context.Context, id string, status shareddomain.OrderStatus, paymentStatus shareddomain.PaymentStatus) (*shareddomain.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	validTransitions := map[shareddomain.OrderStatus][]shareddomain.OrderStatus{
		shareddomain.OrderStatusPending:    {shareddomain.OrderStatusConfirmed, shareddomain.OrderStatusCancelled},
		shareddomain.OrderStatusConfirmed:  {shareddomain.OrderStatusProcessing, shareddomain.OrderStatusCancelled},
		shareddomain.OrderStatusProcessing: {shareddomain.OrderStatusShipped, shareddomain.OrderStatusCancelled},
		shareddomain.OrderStatusShipped:    {shareddomain.OrderStatusDelivered},
		shareddomain.OrderStatusDelivered:  {shareddomain.OrderStatusRefunded},
		shareddomain.OrderStatusCancelled:  {},
		shareddomain.OrderStatusRefunded:   {},
	}

	allowed := validTransitions[order.Status]
	ok := false
	for _, s := range allowed {
		if s == status {
			ok = true
			break
		}
	}
	if !ok && order.Status != status {
		return nil, fmt.Errorf("transition de statut invalide : %s -> %s", order.Status, status)
	}

	if err := s.orderRepo.UpdateStatus(ctx, id, status, paymentStatus); err != nil {
		return nil, err
	}

	order.Status = status
	if paymentStatus != "" {
		order.PaymentStatus = paymentStatus
	}
	order.UpdatedAt = time.Now().UTC()

	// Evenements metier
	if status == shareddomain.OrderStatusCancelled {
		s.publish(ctx, events.RoutingOrderCancelled, events.OrderCancelledEvent{
			EventID:     uuid.New().String(),
			OccurredAt:  time.Now().UTC(),
			OrderID:     order.ID,
			OrderNumber: order.OrderNumber,
			UserID:      order.UserID,
			Items:       s.itemsToEvents(order.Items),
			Reason:      "cancelled",
		})
	}
	if paymentStatus == shareddomain.PaymentStatusPaid || status == shareddomain.OrderStatusConfirmed {
		s.publish(ctx, events.RoutingOrderPaid, events.OrderPaidEvent{
			EventID:       uuid.New().String(),
			OccurredAt:    time.Now().UTC(),
			OrderID:       order.ID,
			OrderNumber:   order.OrderNumber,
			UserID:        order.UserID,
			Items:         s.itemsToEvents(order.Items),
			Total:         order.Total,
			PaymentMethod: order.PaymentMethod,
		})
	}
	return order, nil
}

func (s *OrderService) CancelOrder(ctx context.Context, id, userID string) (*shareddomain.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order.UserID != userID {
		return nil, errors.New("acces refuse")
	}
	if order.Status != shareddomain.OrderStatusPending && order.Status != shareddomain.OrderStatusConfirmed {
		return nil, errors.New("cette commande ne peut plus etre annulee")
	}
	return s.UpdateStatus(ctx, id, shareddomain.OrderStatusCancelled, shareddomain.PaymentStatusRefunded)
}

// PayOrder - paiement client (mobile money / boutique)
func (s *OrderService) PayOrder(ctx context.Context, id, userID, method, phone string) (*shareddomain.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if order.UserID != userID {
		return nil, errors.New("acces refuse")
	}
	if order.Status == shareddomain.OrderStatusCancelled {
		return nil, errors.New("commande annulee")
	}
	if order.PaymentStatus == shareddomain.PaymentStatusPaid {
		return nil, errors.New("commande deja payee")
	}

	// Mobile Money Madagascar : initiation (simulation en attente de confirmation operateur)
	switch method {
	case "mvola", "orange_money", "airtel_money", "store", "mobile_money":
		// ok
	default:
		return nil, errors.New("methode de paiement invalide")
	}

	order.PaymentMethod = method
	if phone != "" {
		if order.Notes == "" {
			order.Notes = "Tel: " + phone
		} else {
			order.Notes = order.Notes + " | Tel: " + phone
		}
	}

	// Boutique : en attente de paiement physique.
	// Mobile Money : en simulation on valide automatiquement (paid).
	// En production: initier API operateur puis ConfirmPayment via webhook.
	if method == "store" {
		order.PaymentStatus = shareddomain.PaymentStatusPending
		order.Status = shareddomain.OrderStatusConfirmed
	} else {
		// mvola / orange_money / airtel_money / mobile_money — simulation: paye immediatement
		order.PaymentStatus = shareddomain.PaymentStatusPaid
		order.Status = shareddomain.OrderStatusConfirmed
		s.publish(ctx, events.RoutingOrderPaid, events.OrderPaidEvent{
			EventID:       uuid.New().String(),
			OccurredAt:    time.Now().UTC(),
			OrderID:       order.ID,
			OrderNumber:   order.OrderNumber,
			UserID:        order.UserID,
			Items:         s.itemsToEvents(order.Items),
			Total:         order.Total,
			PaymentMethod: method,
		})
	}
	order.UpdatedAt = time.Now().UTC()

	if err := s.orderRepo.Update(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

func (s *OrderService) GetStats(ctx context.Context, days int) (*shareddomain.OrderStats, error) {
	return s.orderRepo.GetStats(ctx, days)
}

// ConfirmPayment — webhook operateur Mobile Money (MVola / Orange / Airtel)
// ou confirmation admin. Publie order.paid.
func (s *OrderService) ConfirmPayment(ctx context.Context, orderID, providerRef, status string) (*shareddomain.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		// fallback order_number
		order, err = s.orderRepo.FindByOrderNumber(ctx, orderID)
		if err != nil {
			return nil, errors.New("commande introuvable")
		}
	}
	if order.PaymentStatus == shareddomain.PaymentStatusPaid {
		return order, nil
	}
	st := strings.ToLower(status)
	if st == "failed" || st == "cancelled" || st == "rejected" {
		order.PaymentStatus = shareddomain.PaymentStatusFailed
		order.UpdatedAt = time.Now().UTC()
		_ = s.orderRepo.Update(ctx, order)
		return order, nil
	}
	// success
	if providerRef != "" {
		note := "Ref paiement: " + providerRef
		if order.Notes == "" {
			order.Notes = note
		} else {
			order.Notes = order.Notes + " | " + note
		}
	}
	order.PaymentStatus = shareddomain.PaymentStatusPaid
	if order.Status == shareddomain.OrderStatusPending {
		order.Status = shareddomain.OrderStatusConfirmed
	}
	order.UpdatedAt = time.Now().UTC()
	if err := s.orderRepo.Update(ctx, order); err != nil {
		return nil, err
	}
	s.publish(ctx, events.RoutingOrderPaid, events.OrderPaidEvent{
		EventID:       uuid.New().String(),
		OccurredAt:    time.Now().UTC(),
		OrderID:       order.ID,
		OrderNumber:   order.OrderNumber,
		UserID:        order.UserID,
		Items:         s.itemsToEvents(order.Items),
		Total:         order.Total,
		PaymentMethod: order.PaymentMethod,
	})
	return order, nil
}

// GenerateInvoice attribue un numero de facture si paiement confirme
func (s *OrderService) GenerateInvoice(ctx context.Context, orderID string) (*shareddomain.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.InvoiceNumber != "" {
		return order, nil
	}
	if order.PaymentStatus != shareddomain.PaymentStatusPaid {
		return nil, errors.New("facture disponible uniquement pour commandes payees")
	}
	order.InvoiceNumber = fmt.Sprintf("FAC-%s-%s", time.Now().Format("20060102"), order.OrderNumber[len(order.OrderNumber)-8:])
	order.UpdatedAt = time.Now().UTC()
	if err := s.orderRepo.Update(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// GetInvoice payload structure pour impression admin
func (s *OrderService) GetInvoice(ctx context.Context, orderID string) (map[string]interface{}, error) {
	order, err := s.GenerateInvoice(ctx, orderID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"invoice_number":  order.InvoiceNumber,
		"order_number":    order.OrderNumber,
		"order_id":        order.ID,
		"user_id":         order.UserID,
		"items":           order.Items,
		"sub_total":       order.SubTotal,
		"shipping_cost":   order.ShippingCost,
		"discount":        order.Discount,
		"tax":             order.Tax,
		"total":           order.Total,
		"currency":        "MGA",
		"payment_method":  order.PaymentMethod,
		"payment_status":  order.PaymentStatus,
		"shipping_address": order.ShippingAddress,
		"issued_at":       time.Now().UTC(),
		"created_at":      order.CreatedAt,
	}, nil
}

func (s *OrderService) BuildInvoicePDF(ctx context.Context, orderID string) ([]byte, string, error) {
	order, err := s.GenerateInvoice(ctx, orderID)
	if err != nil {
		return nil, "", err
	}
	lines := make([][3]string, 0, len(order.Items))
	for _, it := range order.Items {
		lines = append(lines, [3]string{
			it.ProductName,
			fmt.Sprintf("%d", it.Quantity),
			fmt.Sprintf("%.0f", it.TotalPrice),
		})
	}
	data := pdf.SimpleInvoice(
		"FACTURE L'AMI",
		"L'AMI - Assistance Informatique, Fianarantsoa",
		order.InvoiceNumber,
		order.OrderNumber,
		order.CreatedAt.Format("2006-01-02"),
		lines,
		fmt.Sprintf("%.0f", order.Total),
	)
	return data, order.InvoiceNumber + ".pdf", nil
}