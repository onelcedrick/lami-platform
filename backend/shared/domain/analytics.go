package domain

import "time"

// DailyVisitorStats - visiteurs uniques hors login par jour
type DailyVisitorStats struct {
	ID            string    `json:"id" bson:"_id,omitempty"`
	Date          string    `json:"date" bson:"date"` // YYYY-MM-DD (UTC)
	UniqueVisitors int      `json:"unique_visitors" bson:"unique_visitors"`
	PageViews     int       `json:"page_views" bson:"page_views"`
	VisitorIDs    []string  `json:"-" bson:"visitor_ids"` // hashes anonymes
	UpdatedAt     time.Time `json:"updated_at" bson:"updated_at"`
}

// ActivityLog - journal d'activites application
type ActivityLog struct {
	ID         string                 `json:"id" bson:"_id,omitempty"`
	Timestamp  time.Time              `json:"timestamp" bson:"timestamp"`
	Action     string                 `json:"action" bson:"action"`
	Category   string                 `json:"category" bson:"category"` // auth, catalog, order, ticket, admin, system, visit
	ActorID    string                 `json:"actor_id,omitempty" bson:"actor_id,omitempty"`
	ActorEmail string                 `json:"actor_email,omitempty" bson:"actor_email,omitempty"`
	ActorRole  string                 `json:"actor_role,omitempty" bson:"actor_role,omitempty"`
	IsGuest    bool                   `json:"is_guest" bson:"is_guest"`
	Message    string                 `json:"message" bson:"message"`
	Resource   string                 `json:"resource,omitempty" bson:"resource,omitempty"`
	ResourceID string                 `json:"resource_id,omitempty" bson:"resource_id,omitempty"`
	IP         string                 `json:"ip,omitempty" bson:"ip,omitempty"`
	UserAgent  string                 `json:"user_agent,omitempty" bson:"user_agent,omitempty"`
	Path       string                 `json:"path,omitempty" bson:"path,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

type TrackVisitRequest struct {
	VisitorID string `json:"visitor_id" validate:"required"` // UUID anonyme stocke localStorage
	Path      string `json:"path,omitempty"`
	Referrer  string `json:"referrer,omitempty"`
}

type CreateActivityRequest struct {
	Action     string                 `json:"action" validate:"required"`
	Category   string                 `json:"category"`
	Message    string                 `json:"message"`
	Resource   string                 `json:"resource,omitempty"`
	ResourceID string                 `json:"resource_id,omitempty"`
	Path       string                 `json:"path,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	// Optionnel si non authentifie
	VisitorID string `json:"visitor_id,omitempty"`
}

type VisitorSummary struct {
	TodayUnique     int                `json:"today_unique"`
	TodayPageViews  int                `json:"today_page_views"`
	YesterdayUnique int                `json:"yesterday_unique"`
	Last7DaysUnique int                `json:"last_7_days_unique"`
	Last7DaysViews  int                `json:"last_7_days_views"`
	Daily           []DailyVisitorStats `json:"daily"`
}
