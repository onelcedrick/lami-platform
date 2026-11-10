package application

import (
	"context"
	"fmt"
	"time"

	redisclient "github.com/lami-platform/shared/pkg/redis"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/analytics/internal/domain"
)

type AnalyticsService struct {
	visitors domain.VisitorRepository
	logs     domain.ActivityRepository
	hub      *LiveHub
	redis    *redisclient.Client
}

func NewAnalyticsService(
	visitors domain.VisitorRepository,
	logs domain.ActivityRepository,
	hub *LiveHub,
	redis *redisclient.Client,
) *AnalyticsService {
	return &AnalyticsService{
		visitors: visitors,
		logs:     logs,
		hub:      hub,
		redis:    redis,
	}
}

// Cles Redis pour le temps reel
const (
	onlinePrefix   = "online:"        // online:{date}:{visitorID} = "1" (TTL 5min)
	visitorsKey    = "visitors:"      // visitors:{date} = compteur INCR
	pageviewsKey   = "pageviews:"     // pageviews:{date} = compteur INCR
	topProductsKey = "products:top:"  // products:top:{date} = sorted set
	kpiCacheKey    = "kpi:snapshot"   // cache KPI 30s
	onlineTTL      = 5 * time.Minute
	dailyTTL       = 48 * time.Hour
	kpiCacheTTL    = 30 * time.Second
)

func todayUTC() string {
	return time.Now().UTC().Format("2006-01-02")
}

func (s *AnalyticsService) TrackVisit(ctx context.Context, req shareddomain.TrackVisitRequest, ip, ua string) (*shareddomain.DailyVisitorStats, error) {
	if req.VisitorID == "" {
		req.VisitorID = uuid.New().String()
	}
	date := todayUTC()

	// 1. MongoDB (persistance)
	stats, err := s.visitors.TrackVisit(ctx, date, req.VisitorID)
	if err != nil {
		return nil, err
	}
	stats.VisitorIDs = nil

	// 2. Redis (temps reel)
	if s.redis != nil {
		// Marquer visiteur en ligne (TTL 5min)
		onlineKey := onlinePrefix + date + ":" + req.VisitorID
		_ = s.redis.Set(ctx, onlineKey, "1", onlineTTL)

		// Incrementer compteurs
		visitorsCounterKey := visitorsKey + date
		_, _ = s.redis.Incr(ctx, visitorsCounterKey)
		_ = s.redis.Expire(ctx, visitorsCounterKey, dailyTTL)

		pageviewsCounterKey := pageviewsKey + date
		_, _ = s.redis.Incr(ctx, pageviewsCounterKey)
		_ = s.redis.Expire(ctx, pageviewsCounterKey, dailyTTL)

		// Invalider le cache KPI
		_ = s.redis.Del(ctx, kpiCacheKey)
	}

	// 3. SSE (broadcast)
	if s.hub != nil {
		s.hub.PublishVisitor(req.VisitorID, ip, ua)
	}
	return stats, nil
}

// GetOnlineCount retourne le nombre de visiteurs en ligne.
func (s *AnalyticsService) GetOnlineCount(ctx context.Context) (int64, error) {
	if s.redis == nil {
		return 0, nil
	}
	date := todayUTC()
	pattern := onlinePrefix + date + ":*"
	raw := s.redis.Raw()
	keys, err := raw.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, err
	}
	return int64(len(keys)), nil
}

// GetTodayStats retourne les stats temps reel du jour.
func (s *AnalyticsService) GetTodayStats(ctx context.Context) (map[string]int64, error) {
	if s.redis == nil {
		return map[string]int64{}, nil
	}
	date := todayUTC()

	visitors, _ := s.redis.Get(ctx, visitorsKey+date)
	pageviews, _ := s.redis.Get(ctx, pageviewsKey+date)

	var visitorsN, pageviewsN int64
	if visitors != "" {
		fmt.Sscanf(visitors, "%d", &visitorsN)
	}
	if pageviews != "" {
		fmt.Sscanf(pageviews, "%d", &pageviewsN)
	}

	return map[string]int64{
		"visitors":  visitorsN,
		"pageviews": pageviewsN,
		"online":    0, // calcul separe
	}, nil
}

// TrackProductView incremente le compteur de vues d'un produit.
func (s *AnalyticsService) TrackProductView(ctx context.Context, productID, productName string) error {
	if s.redis == nil || productID == "" {
		return nil
	}
	date := todayUTC()
	key := topProductsKey + date
	raw := s.redis.Raw()
	// ZINCRBY : incremente le score du produit dans le sorted set
	if err := raw.ZIncrBy(ctx, key, 1, productID).Err(); err != nil {
		return err
	}
	_ = s.redis.Expire(ctx, key, dailyTTL)
	return nil
}

// GetTopProducts retourne les N produits les plus vus aujourd'hui.
func (s *AnalyticsService) GetTopProducts(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	if s.redis == nil || limit <= 0 {
		limit = 5
	}
	date := todayUTC()
	key := topProductsKey + date
	raw := s.redis.Raw()

	results, err := raw.ZRevRangeWithScores(ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}

	out := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		out = append(out, map[string]interface{}{
			"product_id": r.Member,
			"views":      int64(r.Score),
		})
	}
	return out, nil
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

	if s.hub != nil {
		s.hub.PublishActivity(log)
	}
	return log, nil
}

func (s *AnalyticsService) ListActivities(ctx context.Context, page, limit int, category, actorID string) ([]shareddomain.ActivityLog, int64, error) {
	return s.logs.List(ctx, page, limit, category, actorID)
}
