package application

import (
	"encoding/json"
	"sync"
	"time"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

// LiveEvent est un evenement diffuse en SSE.
type LiveEvent struct {
	Type      string                 `json:"type"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// LiveHub diffuse les evenements a tous les clients SSE connectes.
type LiveHub struct {
	mu         sync.RWMutex
	clients    map[chan LiveEvent]struct{}
	bufferSize int
	recent     []LiveEvent
	recentMax  int
}

func NewLiveHub() *LiveHub {
	return &LiveHub{
		clients:    make(map[chan LiveEvent]struct{}),
		bufferSize: 64,
		recent:     make([]LiveEvent, 0, 50),
		recentMax:  50,
	}
}

// Subscribe retourne un canal + une fonction unsubscribe.
func (h *LiveHub) Subscribe() (chan LiveEvent, func()) {
	ch := make(chan LiveEvent, h.bufferSize)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	replay := make([]LiveEvent, 0, 10)
	if len(h.recent) > 10 {
		replay = append(replay, h.recent[len(h.recent)-10:]...)
	} else {
		replay = append(replay, h.recent...)
	}
	h.mu.Unlock()

	go func() {
		for _, ev := range replay {
			select {
			case ch <- ev:
			case <-time.After(100 * time.Millisecond):
				return
			}
		}
	}()

	return ch, func() {
		h.mu.Lock()
		delete(h.clients, ch)
		h.mu.Unlock()
		close(ch)
	}
}

// Broadcast envoie un evenement a tous les clients (non-bloquant).
func (h *LiveHub) Broadcast(ev LiveEvent) {
	h.mu.Lock()
	h.recent = append(h.recent, ev)
	if len(h.recent) > h.recentMax {
		h.recent = h.recent[len(h.recent)-h.recentMax:]
	}
	clients := make([]chan LiveEvent, 0, len(h.clients))
	for ch := range h.clients {
		clients = append(clients, ch)
	}
	h.mu.Unlock()

	for _, ch := range clients {
		select {
		case ch <- ev:
		default:
			logger.Warn().Msg("LiveHub: client lent, event droppe")
		}
	}
}

// PublishOrderEvent - appele depuis HandleOrderEvent
func (h *LiveHub) PublishOrderEvent(routingKey string, body []byte) {
	var ev LiveEvent
	ev.Timestamp = time.Now().UTC()

	switch routingKey {
	case events.RoutingOrderCreated:
		var e events.OrderCreatedEvent
		if err := json.Unmarshal(body, &e); err != nil {
			return
		}
		ev.Type = "order"
		ev.Level = "info"
		ev.Message = "Commande creee " + e.OrderNumber
		ev.Data = map[string]interface{}{
			"order_id":     e.OrderID,
			"order_number": e.OrderNumber,
			"total":        e.Total,
			"user_id":      e.UserID,
		}
	case events.RoutingOrderPaid:
		var e events.OrderPaidEvent
		if err := json.Unmarshal(body, &e); err != nil {
			return
		}
		ev.Type = "order"
		ev.Level = "info"
		ev.Message = "Commande payee " + e.OrderNumber
		ev.Data = map[string]interface{}{
			"order_id":     e.OrderID,
			"order_number": e.OrderNumber,
			"total":        e.Total,
			"method":       e.PaymentMethod,
		}
	case events.RoutingOrderCancelled:
		var e events.OrderCancelledEvent
		if err := json.Unmarshal(body, &e); err != nil {
			return
		}
		ev.Type = "order"
		ev.Level = "warn"
		ev.Message = "Commande annulee " + e.OrderNumber
		ev.Data = map[string]interface{}{
			"order_id":     e.OrderID,
			"order_number": e.OrderNumber,
			"reason":       e.Reason,
		}
	default:
		return
	}

	h.Broadcast(ev)
}

// PublishVisitor - pour les nouvelles visites
func (h *LiveHub) PublishVisitor(visitorID, ip, ua string) {
	h.Broadcast(LiveEvent{
		Type:      "visitor",
		Level:     "info",
		Message:   "Nouvelle visite",
		Timestamp: time.Now().UTC(),
		Data: map[string]interface{}{
			"visitor_id": visitorID,
			"ip":         ip,
			"user_agent": ua,
		},
	})
}

// PublishActivity - pour les logs d'activite
func (h *LiveHub) PublishActivity(log *shareddomain.ActivityLog) {
	level := "info"
	if log.Action == "order_cancelled" || log.Action == "error" {
		level = "warn"
	}
	h.Broadcast(LiveEvent{
		Type:      "activity",
		Level:     level,
		Message:   log.Message,
		Timestamp: log.Timestamp,
		Data: map[string]interface{}{
			"action":      log.Action,
			"category":    log.Category,
			"actor_email": log.ActorEmail,
			"resource_id": log.ResourceID,
		},
	})
}

// PublishError - pour les erreurs
func (h *LiveHub) PublishError(source, message string) {
	h.Broadcast(LiveEvent{
		Type:      "error",
		Level:     "error",
		Message:   message,
		Timestamp: time.Now().UTC(),
		Data: map[string]interface{}{
			"source": source,
		},
	})
}
