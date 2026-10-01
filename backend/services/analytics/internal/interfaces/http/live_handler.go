package http

import (
	"bufio"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/lami-platform/services/analytics/internal/application"
)

// LiveHandler gere les routes SSE + health + KPI.
type LiveHandler struct {
	hub    *application.LiveHub
	health *application.HealthChecker
	kpi    *application.KPIAggregator
}

func NewLiveHandler(hub *application.LiveHub, health *application.HealthChecker, kpi *application.KPIAggregator) *LiveHandler {
	return &LiveHandler{hub: hub, health: health, kpi: kpi}
}

// Stream - SSE endpoint
func (h *LiveHandler) Stream(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		events, unsubscribe := h.hub.Subscribe()
		defer unsubscribe()

		fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\"}\n\n")
		if err := w.Flush(); err != nil {
			return
		}

		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case ev, ok := <-events:
				if !ok {
					return
				}
				data, _ := json.Marshal(ev)
				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, data)
				if err := w.Flush(); err != nil {
					return
				}
			case <-heartbeat.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	})

	return nil
}

// HealthAll - sante des 9 services
func (h *LiveHandler) HealthAll(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success":  true,
		"services": h.health.Snapshot(),
	})
}

// KPI - KPIs temps reel
func (h *LiveHandler) KPI(c *fiber.Ctx) error {
	snap, err := h.kpi.Snapshot(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "data": snap})
}
