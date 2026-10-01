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

// ============================================================
// AJOUT : Events pour le dashboard temps reel
// ============================================================

const (
	// Nouvelles queues
	QueueAnalyticsLive    = "analytics.live"
	QueueAnalyticsCatalog = "analytics.catalog"
	QueueAnalyticsTicket  = "analytics.ticket"

	// Nouveaux routing keys
	RoutingProductViewed  = "product.viewed"
	RoutingTicketCreated  = "ticket.created"
	RoutingTicketAssigned = "ticket.assigned"
	RoutingIAChatDone     = "ia.chat.completed"
	RoutingServiceBeat    = "service.heartbeat"
)

// ProductViewedEvent - publie par catalog-service a chaque vue produit
type ProductViewedEvent struct {
	EventID     string    `json:"event_id"`
	OccurredAt  time.Time `json:"occurred_at"`
	ProductID   string    `json:"product_id"`
	ProductName string    `json:"product_name"`
	UserID      string    `json:"user_id,omitempty"`
	VisitorID   string    `json:"visitor_id,omitempty"`
}

// TicketCreatedEvent - publie par ticket-service
type TicketCreatedEvent struct {
	EventID      string    `json:"event_id"`
	OccurredAt   time.Time `json:"occurred_at"`
	TicketID     string    `json:"ticket_id"`
	TicketNumber string    `json:"ticket_number"`
	UserID       string    `json:"user_id"`
	Title        string    `json:"title"`
	Category     string    `json:"category"`
	Priority     string    `json:"priority"`
	AutoAssigned bool      `json:"auto_assigned"`
}

// TicketAssignedEvent - publie par ticket-service
type TicketAssignedEvent struct {
	EventID      string    `json:"event_id"`
	OccurredAt   time.Time `json:"occurred_at"`
	TicketID     string    `json:"ticket_id"`
	TicketNumber string    `json:"ticket_number"`
	TechnicianID string    `json:"technician_id"`
	AutoAssigned bool      `json:"auto_assigned"`
}

// IAChatCompletedEvent - publie par ia-service (optionnel)
type IAChatCompletedEvent struct {
	EventID        string    `json:"event_id"`
	OccurredAt     time.Time `json:"occurred_at"`
	ConversationID string    `json:"conversation_id"`
	Mode           string    `json:"mode"`
	LatencyMs      int       `json:"latency_ms"`
	ToolCalls      int       `json:"tool_calls"`
	Error          bool      `json:"error"`
}

// ServiceHeartbeatEvent - publie periodiquement par chaque service
type ServiceHeartbeatEvent struct {
	EventID   string    `json:"event_id"`
	Service   string    `json:"service"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"occurred_at"`
	LatencyMs int       `json:"latency_ms,omitempty"`
}
