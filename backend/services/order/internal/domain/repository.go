package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type OrderRepository interface {
	Create(ctx context.Context, order *shareddomain.Order) error
	FindByID(ctx context.Context, id string) (*shareddomain.Order, error)
	FindByOrderNumber(ctx context.Context, orderNumber string) (*shareddomain.Order, error)
	FindByUserID(ctx context.Context, userID string, page, limit int) ([]shareddomain.Order, int64, error)
	Update(ctx context.Context, order *shareddomain.Order) error
	UpdateStatus(ctx context.Context, id string, status shareddomain.OrderStatus, paymentStatus shareddomain.PaymentStatus) error
	List(ctx context.Context, page, limit int, status string) ([]shareddomain.Order, int64, error)
	GetStats(ctx context.Context, days int) (*shareddomain.OrderStats, error)
}
