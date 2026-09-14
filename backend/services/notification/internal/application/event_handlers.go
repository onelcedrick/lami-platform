package application

import (
	"context"
	"encoding/json"
	"fmt"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

func (s *NotificationService) HandleOrderEvent(ctx context.Context, routingKey string, body []byte) error {
	switch routingKey {
	case events.RoutingOrderCreated:
		var ev events.OrderCreatedEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Str("user", ev.UserID).Msg("Notification: order.created")
		_, err := s.Create(ctx, shareddomain.CreateNotificationRequest{
			UserID: ev.UserID,
			Type:   shareddomain.NotificationTypeInApp,
			Title:  "Commande enregistree",
			Body:   fmt.Sprintf("Votre commande %s a ete enregistree (total %.0f Ar).", ev.OrderNumber, ev.Total),
			Data: map[string]string{
				"order_id":     ev.OrderID,
				"order_number": ev.OrderNumber,
			},
		})
		return err

	case events.RoutingOrderPaid:
		var ev events.OrderPaidEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Msg("Notification: order.paid")
		_, err := s.Create(ctx, shareddomain.CreateNotificationRequest{
			UserID: ev.UserID,
			Type:   shareddomain.NotificationTypeInApp,
			Title:  "Paiement confirme",
			Body:   fmt.Sprintf("Paiement confirme pour la commande %s.", ev.OrderNumber),
			Data: map[string]string{
				"order_id":     ev.OrderID,
				"order_number": ev.OrderNumber,
			},
		})
		return err

	case events.RoutingOrderCancelled:
		var ev events.OrderCancelledEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Msg("Notification: order.cancelled")
		_, err := s.Create(ctx, shareddomain.CreateNotificationRequest{
			UserID: ev.UserID,
			Type:   shareddomain.NotificationTypeInApp,
			Title:  "Commande annulee",
			Body:   fmt.Sprintf("La commande %s a ete annulee.", ev.OrderNumber),
			Data: map[string]string{
				"order_id":     ev.OrderID,
				"order_number": ev.OrderNumber,
			},
		})
		return err
	}
	return nil
}
