package application

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/notification/internal/domain"
)

type NotificationService struct {
	repo domain.NotificationRepository
}

func NewNotificationService(repo domain.NotificationRepository) *NotificationService {
	return &NotificationService{repo: repo}
}

func (s *NotificationService) Create(ctx context.Context, req shareddomain.CreateNotificationRequest) (*shareddomain.Notification, error) {
	channel := req.Channel
	if channel == "" {
		channel = string(req.Type)
	}

	now := time.Now().UTC()
	n := &shareddomain.Notification{
		ID:        uuid.New().String(),
		UserID:    req.UserID,
		Type:      req.Type,
		Channel:   channel,
		Title:     req.Title,
		Body:      req.Body,
		Data:      req.Data,
		Status:    shareddomain.NotificationStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if n.Data == nil {
		n.Data = map[string]string{}
	}

	if err := s.repo.Create(ctx, n); err != nil {
		return nil, err
	}

	// Simulation d'envoi (email/SMS/push). En production : integration SMTP, Twilio, FCM, etc.
	sentAt := time.Now().UTC()
	n.Status = shareddomain.NotificationStatusSent
	n.SentAt = &sentAt
	n.UpdatedAt = sentAt
	_ = s.repo.UpdateStatus(ctx, n.ID, shareddomain.NotificationStatusSent)

	return n, nil
}

func (s *NotificationService) GetByID(ctx context.Context, id string) (*shareddomain.Notification, error) {
	return s.repo.FindByID(ctx, id)
}

func (s *NotificationService) GetUserNotifications(ctx context.Context, userID string, page, limit int, unreadOnly bool) ([]shareddomain.Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.repo.FindByUserID(ctx, userID, page, limit, unreadOnly)
}

func (s *NotificationService) MarkAsRead(ctx context.Context, id, userID string) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}

func (s *NotificationService) CountUnread(ctx context.Context, userID string) (int64, error) {
	return s.repo.CountUnread(ctx, userID)
}

func (s *NotificationService) NotifyOrderCreated(ctx context.Context, userID, orderNumber string) (*shareddomain.Notification, error) {
	return s.Create(ctx, shareddomain.CreateNotificationRequest{
		UserID: userID,
		Type:   shareddomain.NotificationTypeEmail,
		Title:  "Commande confirmee",
		Body:   "Votre commande " + orderNumber + " a bien ete enregistree. Vous recevrez un email de suivi.",
		Data:   map[string]string{"order_number": orderNumber, "event": "order_created"},
	})
}

func (s *NotificationService) NotifyTicketCreated(ctx context.Context, userID, ticketNumber string) (*shareddomain.Notification, error) {
	return s.Create(ctx, shareddomain.CreateNotificationRequest{
		UserID: userID,
		Type:   shareddomain.NotificationTypeInApp,
		Title:  "Ticket cree",
		Body:   "Votre ticket " + ticketNumber + " a ete cree. Un technicien vous repondra rapidement.",
		Data:   map[string]string{"ticket_number": ticketNumber, "event": "ticket_created"},
	})
}

func (s *NotificationService) NotifyTicketAssigned(ctx context.Context, technicianID, ticketNumber string) (*shareddomain.Notification, error) {
	return s.Create(ctx, shareddomain.CreateNotificationRequest{
		UserID: technicianID,
		Type:   shareddomain.NotificationTypeInApp,
		Title:  "Nouveau ticket assigne",
		Body:   "Le ticket " + ticketNumber + " vous a ete assigne.",
		Data:   map[string]string{"ticket_number": ticketNumber, "event": "ticket_assigned"},
	})
}

func (s *NotificationService) EnsureOwner(ctx context.Context, id, userID string) (*shareddomain.Notification, error) {
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if n.UserID != userID {
		return nil, errors.New("acces refuse")
	}
	return n, nil
}
