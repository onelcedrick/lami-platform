package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type NotificationRepository interface {
	Create(ctx context.Context, n *shareddomain.Notification) error
	FindByID(ctx context.Context, id string) (*shareddomain.Notification, error)
	FindByUserID(ctx context.Context, userID string, page, limit int, unreadOnly bool) ([]shareddomain.Notification, int64, error)
	MarkAsRead(ctx context.Context, id, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	UpdateStatus(ctx context.Context, id string, status shareddomain.NotificationStatus) error
	CountUnread(ctx context.Context, userID string) (int64, error)
}
