package application

import (
	"context"
	"encoding/json"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

func (s *AnalyticsService) HandleOrderEvent(ctx context.Context, routingKey string, body []byte) error {
	var orderID, orderNumber, userID, action, message string
	var total float64

	switch routingKey {
	case events.RoutingOrderCreated:
		var ev events.OrderCreatedEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		orderID, orderNumber, userID, total = ev.OrderID, ev.OrderNumber, ev.UserID, ev.Total
		action = "order_created"
		message = "Commande creee " + orderNumber
	case events.RoutingOrderPaid:
		var ev events.OrderPaidEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		orderID, orderNumber, userID, total = ev.OrderID, ev.OrderNumber, ev.UserID, ev.Total
		action = "order_paid"
		message = "Commande payee " + orderNumber
	case events.RoutingOrderCancelled:
		var ev events.OrderCancelledEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		orderID, orderNumber, userID = ev.OrderID, ev.OrderNumber, ev.UserID
		action = "order_cancelled"
		message = "Commande annulee " + orderNumber
	default:
		return nil
	}

	logger.Info().Str("action", action).Str("order", orderNumber).Msg("Analytics: order event")

	meta := map[string]interface{}{
		"order_number": orderNumber,
		"total":        total,
		"routing_key":  routingKey,
	}
	_, err := s.LogActivity(ctx, shareddomain.CreateActivityRequest{
		Action:     action,
		Category:   "order",
		Message:    message,
		Resource:   "order",
		ResourceID: orderID,
		Metadata:   meta,
	}, userID, "", "system", "", "rabbitmq-consumer")
	if err != nil {
		logger.Warn().Err(err).Msg("Analytics log activity failed")
	}
	return nil
}
