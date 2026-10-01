package events

import "time"

// Routing keys / event types
const (
	ExchangeName = "lami.events"
	ExchangeType = "topic"

	// Queues
	QueueCatalogStock   = "catalog.stock"
	QueueNotification   = "notification.orders"
	QueueAnalyticsOrders = "analytics.orders"

	// Routing keys
	RoutingOrderCreated   = "order.created"
	RoutingOrderPaid      = "order.paid"
	RoutingOrderCancelled = "order.cancelled"
	RoutingOrderStatus    = "order.status_changed"
)

type OrderItemEvent struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name,omitempty"`
	SKU         string  `json:"sku,omitempty"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price,omitempty"`
}

type OrderCreatedEvent struct {
	EventID     string           `json:"event_id"`
	OccurredAt  time.Time        `json:"occurred_at"`
	OrderID     string           `json:"order_id"`
	OrderNumber string           `json:"order_number"`
	UserID      string           `json:"user_id"`
	Items       []OrderItemEvent `json:"items"`
	Total       float64          `json:"total"`
	Currency    string           `json:"currency"`
	PaymentMethod string         `json:"payment_method,omitempty"`
}

type OrderPaidEvent struct {
	EventID       string           `json:"event_id"`
	OccurredAt    time.Time        `json:"occurred_at"`
	OrderID       string           `json:"order_id"`
	OrderNumber   string           `json:"order_number"`
	UserID        string           `json:"user_id"`
	Items         []OrderItemEvent `json:"items"`
	Total         float64          `json:"total"`
	PaymentMethod string           `json:"payment_method,omitempty"`
}

type OrderCancelledEvent struct {
	EventID     string           `json:"event_id"`
	OccurredAt  time.Time        `json:"occurred_at"`
	OrderID     string           `json:"order_id"`
	OrderNumber string           `json:"order_number"`
	UserID      string           `json:"user_id"`
	Items       []OrderItemEvent `json:"items"`
	Reason      string           `json:"reason,omitempty"`
}
