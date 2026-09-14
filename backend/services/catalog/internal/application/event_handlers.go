package application

import (
	"context"
	"encoding/json"

	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

func (s *CatalogService) HandleOrderEvent(ctx context.Context, routingKey string, body []byte) error {
	switch routingKey {
	case events.RoutingOrderCreated:
		var ev events.OrderCreatedEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Int("items", len(ev.Items)).Msg("Catalog: order.created → decrement stock")
		for _, it := range ev.Items {
			if err := s.DecrementStock(ctx, it.ProductID, it.Quantity); err != nil {
				logger.Error().Err(err).Str("product_id", it.ProductID).Msg("Stock decrement failed")
				// On continue les autres lignes; en prod: saga / compensation
			}
		}
		return nil

	case events.RoutingOrderPaid:
		var ev events.OrderPaidEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Msg("Catalog: order.paid → sales_count")
		for _, it := range ev.Items {
			_ = s.RecordSale(ctx, it.ProductID, it.Quantity)
		}
		return nil

	case events.RoutingOrderCancelled:
		var ev events.OrderCancelledEvent
		if err := json.Unmarshal(body, &ev); err != nil {
			return err
		}
		logger.Info().Str("order", ev.OrderNumber).Msg("Catalog: order.cancelled → restock")
		for _, it := range ev.Items {
			_ = s.Restock(ctx, it.ProductID, it.Quantity)
		}
		return nil
	}
	return nil
}
