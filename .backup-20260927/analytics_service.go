package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/analytics/internal/domain"
)

type AnalyticsService struct {
	visitors domain.VisitorRepository
	logs     domain.ActivityRepository
}

func NewAnalyticsService(visitors domain.VisitorRepository, logs domain.ActivityRepository) *AnalyticsService {
	return &AnalyticsService{visitors: visitors, logs: logs}
}

func todayUTC() string {
	return time.Now().UTC().Format("2006-01-02")
}

func (s *AnalyticsService) TrackVisit(ctx context.Context, req shareddomain.TrackVisitRequest, ip, ua string) (*shareddomain.DailyVisitorStats, error) {
	if req.VisitorID == "" {
		req.VisitorID = uuid.New().String()
	}
	date := todayUTC()
	stats, err := s.visitors.TrackVisit(ctx, date, req.VisitorID)
	if err != nil {
		return nil, err
	}
	// Les page views restent dans daily_visitors (pas dans activity_logs pour eviter le bruit)
	_ = ip
	_ = ua
	stats.VisitorIDs = nil
	return stats, nil
}

func (s *AnalyticsService) VisitorSummary(ctx context.Context, days int) (*shareddomain.VisitorSummary, error) {
	if days < 1 {
		days = 7
	}
	if days > 90 {
		days = 90
	}

	today := time.Now().UTC()
	from := today.AddDate(0, 0, -(days - 1)).Format("2006-01-02")
	to := today.Format("2006-01-02")

	daily, err := s.visitors.ListRange(ctx, from, to)
	if err != nil {
		return nil, err
	}

	summary := &shareddomain.VisitorSummary{Daily: daily}
	yesterday := today.AddDate(0, 0, -1).Format("2006-01-02")

	for _, d := range daily {
		summary.Last7DaysUnique += d.UniqueVisitors
		summary.Last7DaysViews += d.PageViews
		if d.Date == to {
			summary.TodayUnique = d.UniqueVisitors
			summary.TodayPageViews = d.PageViews
		}
		if d.Date == yesterday {
			summary.YesterdayUnique = d.UniqueVisitors
		}
	}

	return summary, nil
}

func (s *AnalyticsService) LogActivity(ctx context.Context, req shareddomain.CreateActivityRequest, actorID, email, role, ip, ua string) (*shareddomain.ActivityLog, error) {
	isGuest := actorID == ""
	category := req.Category
	if category == "" {
		category = "system"
	}
	msg := req.Message
	if msg == "" {
		msg = req.Action
	}

	log := &shareddomain.ActivityLog{
		ID:         uuid.New().String(),
		Timestamp:  time.Now().UTC(),
		Action:     req.Action,
		Category:   category,
		ActorID:    actorID,
		ActorEmail: email,
		ActorRole:  role,
		IsGuest:    isGuest,
		Message:    msg,
		Resource:   req.Resource,
		ResourceID: req.ResourceID,
		IP:         ip,
		UserAgent:  ua,
		Path:       req.Path,
		Metadata:   req.Metadata,
	}
	if err := s.logs.Create(ctx, log); err != nil {
		return nil, err
	}
	return log, nil
}

func (s *AnalyticsService) ListActivities(ctx context.Context, page, limit int, category, actorID string) ([]shareddomain.ActivityLog, int64, error) {
	return s.logs.List(ctx, page, limit, category, actorID)
}
