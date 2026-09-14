package otel

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/metrics"
)

// Middleware - traces legers (latence + correlation id) compatibles Prometheus.
func Middleware(service string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		traceID := c.Get("X-Request-ID")
		if traceID == "" {
			traceID = fmt.Sprintf("%s-%d", service, start.UnixNano())
		}
		c.Set("X-Request-ID", traceID)
		c.Locals("traceID", traceID)

		err := c.Next()

		ms := time.Since(start).Milliseconds()
		status := fmt.Sprintf("%d", c.Response().StatusCode())
		metrics.Default.Inc("lami_http_requests_total", map[string]string{
			"service": service,
			"method":  c.Method(),
			"path":    c.Route().Path,
			"status":  status,
		}, 1)
		metrics.Default.ObserveMS("lami_http_request_duration_ms", map[string]string{
			"service": service,
			"method":  c.Method(),
		}, ms)

		c.Set("X-Response-Time-Ms", fmt.Sprintf("%d", ms))
		return err
	}
}
