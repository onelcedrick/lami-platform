package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type VisitorRepository interface {
	TrackVisit(ctx context.Context, date, visitorID string) (*shareddomain.DailyVisitorStats, error)
	GetByDate(ctx context.Context, date string) (*shareddomain.DailyVisitorStats, error)
	ListRange(ctx context.Context, fromDate, toDate string) ([]shareddomain.DailyVisitorStats, error)
}

type ActivityRepository interface {
	Create(ctx context.Context, log *shareddomain.ActivityLog) error
	List(ctx context.Context, page, limit int, category, actorID string) ([]shareddomain.ActivityLog, int64, error)
}
