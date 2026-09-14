package domain

import (
	"time"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusConfirmed  OrderStatus = "confirmed"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "pending"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusFailed   PaymentStatus = "failed"
	PaymentStatusRefunded PaymentStatus = "refunded"
)

type OrderItem struct {
	ProductID   string  `json:"product_id" bson:"product_id"`
	ProductName string  `json:"product_name" bson:"product_name"`
	SKU         string  `json:"sku" bson:"sku"`
	Quantity    int     `json:"quantity" bson:"quantity"`
	UnitPrice   float64 `json:"unit_price" bson:"unit_price"`
	TotalPrice  float64 `json:"total_price" bson:"total_price"`
	ImageURL    string  `json:"image_url,omitempty" bson:"image_url,omitempty"`
}

type Order struct {
	ID              string        `json:"id" bson:"_id,omitempty"`
	OrderNumber     string        `json:"order_number" bson:"order_number"`
	UserID          string        `json:"user_id" bson:"user_id"`
	Items           []OrderItem   `json:"items" bson:"items"`
	SubTotal        float64       `json:"sub_total" bson:"sub_total"`
	ShippingCost    float64       `json:"shipping_cost" bson:"shipping_cost"`
	Tax             float64       `json:"tax" bson:"tax"`
	Discount        float64       `json:"discount" bson:"discount"`
	Total           float64       `json:"total" bson:"total"`
	Status          OrderStatus   `json:"status" bson:"status"`
	PaymentStatus   PaymentStatus `json:"payment_status" bson:"payment_status"`
	PaymentMethod   string        `json:"payment_method,omitempty" bson:"payment_method,omitempty"`
	ShippingAddress Address       `json:"shipping_address" bson:"shipping_address"`
	BillingAddress  *Address      `json:"billing_address,omitempty" bson:"billing_address,omitempty"`
	Notes           string        `json:"notes,omitempty" bson:"notes,omitempty"`
	TrackingNumber  string        `json:"tracking_number,omitempty" bson:"tracking_number,omitempty"`
	InvoiceNumber   string        `json:"invoice_number,omitempty" bson:"invoice_number,omitempty"`
	CreatedAt       time.Time     `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at" bson:"updated_at"`
}

type CreateOrderRequest struct {
	Items           []OrderItemRequest `json:"items" validate:"required,min=1"`
	ShippingAddress Address            `json:"shipping_address" validate:"required"`
	BillingAddress  *Address           `json:"billing_address,omitempty"`
	PaymentMethod   string             `json:"payment_method" validate:"required"`
	Notes           string             `json:"notes,omitempty"`
}

type OrderItemRequest struct {
	ProductID   string  `json:"product_id" validate:"required"`
	ProductName string  `json:"product_name,omitempty"`
	SKU         string  `json:"sku,omitempty"`
	Quantity    int     `json:"quantity" validate:"required,gt=0"`
	UnitPrice   float64 `json:"unit_price,omitempty"`
	ImageURL    string  `json:"image_url,omitempty"`
}

// --- Reporting admin consolidé ---

type OrderStats struct {
	TotalOrders       int64              `json:"total_orders"`
	PendingOrders     int64              `json:"pending_orders"`
	PaidOrders        int64              `json:"paid_orders"`
	CancelledOrders   int64              `json:"cancelled_orders"`
	RevenuePaid       float64            `json:"revenue_paid"`
	RevenuePending    float64            `json:"revenue_pending"`
	AverageOrderValue float64            `json:"average_order_value"`
	Currency          string             `json:"currency"`
	DailyRevenue      []DailyRevenuePoint `json:"daily_revenue,omitempty"`
	TopProducts       []ProductSalesPoint `json:"top_products,omitempty"`
	ByPaymentMethod   map[string]int64   `json:"by_payment_method,omitempty"`
	ByStatus          map[string]int64   `json:"by_status,omitempty"`
}

type DailyRevenuePoint struct {
	Date    string  `json:"date"`
	Orders  int64   `json:"orders"`
	Revenue float64 `json:"revenue"`
}

type ProductSalesPoint struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int64   `json:"quantity"`
	Revenue     float64 `json:"revenue"`
}
