package domain

import (
	"time"
)

type NotificationType string

const (
	NotificationTypeEmail NotificationType = "email"
	NotificationTypeSMS   NotificationType = "sms"
	NotificationTypePush  NotificationType = "push"
	NotificationTypeInApp NotificationType = "in_app"
)

type NotificationStatus string

const (
	NotificationStatusPending   NotificationStatus = "pending"
	NotificationStatusSent      NotificationStatus = "sent"
	NotificationStatusFailed    NotificationStatus = "failed"
	NotificationStatusRead      NotificationStatus = "read"
)

type Notification struct {
	ID        string             `json:"id" bson:"_id,omitempty"`
	UserID    string             `json:"user_id" bson:"user_id"`
	Type      NotificationType   `json:"type" bson:"type"`
	Channel   string             `json:"channel" bson:"channel"`
	Title     string             `json:"title" bson:"title"`
	Body      string             `json:"body" bson:"body"`
	Data      map[string]string  `json:"data,omitempty" bson:"data,omitempty"`
	Status    NotificationStatus `json:"status" bson:"status"`
	ReadAt    *time.Time         `json:"read_at,omitempty" bson:"read_at,omitempty"`
	SentAt    *time.Time         `json:"sent_at,omitempty" bson:"sent_at,omitempty"`
	CreatedAt time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time          `json:"updated_at" bson:"updated_at"`
}

type CreateNotificationRequest struct {
	UserID  string            `json:"user_id" validate:"required"`
	Type    NotificationType  `json:"type" validate:"required"`
	Title   string            `json:"title" validate:"required"`
	Body    string            `json:"body" validate:"required"`
	Data    map[string]string `json:"data,omitempty"`
	Channel string            `json:"channel,omitempty"`
}
