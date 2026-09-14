package metrics

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Collecteur Prometheus-compatible (exposition texte) sans dependance lourde.
type Registry struct {
	mu      sync.Mutex
	counters map[string]*int64
	gauges   map[string]*int64
	histSum  map[string]*int64 // latency sum ms
	histCnt  map[string]*int64
}

func New() *Registry {
	return &Registry{
		counters: map[string]*int64{},
		gauges:   map[string]*int64{},
		histSum:  map[string]*int64{},
		histCnt:  map[string]*int64{},
	}
}

var Default = New()

func (r *Registry) key(name string, labels map[string]string) string {
	if len(labels) == 0 {
		return name
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf(`%s="%s"`, k, labels[k]))
	}
	return name + "{" + strings.Join(parts, ",") + "}"
}

func (r *Registry) Inc(name string, labels map[string]string, delta int64) {
	k := r.key(name, labels)
	r.mu.Lock()
	c, ok := r.counters[k]
	if !ok {
		var v int64
		c = &v
		r.counters[k] = c
	}
	r.mu.Unlock()
	atomic.AddInt64(c, delta)
}

func (r *Registry) ObserveMS(name string, labels map[string]string, ms int64) {
	k := r.key(name, labels)
	r.mu.Lock()
	s, ok := r.histSum[k]
	if !ok {
		var sum, cnt int64
		s = &sum
		c := &cnt
		r.histSum[k] = s
		r.histCnt[k] = c
	}
	c := r.histCnt[k]
	r.mu.Unlock()
	atomic.AddInt64(s, ms)
	atomic.AddInt64(c, 1)
}

func (r *Registry) SetGauge(name string, labels map[string]string, val int64) {
	k := r.key(name, labels)
	r.mu.Lock()
	g, ok := r.gauges[k]
	if !ok {
		var v int64
		g = &v
		r.gauges[k] = g
	}
	r.mu.Unlock()
	atomic.StoreInt64(g, val)
}

func (r *Registry) Expose() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var b strings.Builder
	b.WriteString("# HELP lami_http_requests_total Total HTTP requests\n")
	b.WriteString("# TYPE lami_http_requests_total counter\n")
	for k, v := range r.counters {
		b.WriteString(fmt.Sprintf("%s %d\n", k, atomic.LoadInt64(v)))
	}
	b.WriteString("# TYPE lami_gauge gauge\n")
	for k, v := range r.gauges {
		b.WriteString(fmt.Sprintf("%s %d\n", k, atomic.LoadInt64(v)))
	}
	b.WriteString("# TYPE lami_http_latency_ms summary\n")
	for k, s := range r.histSum {
		cnt := atomic.LoadInt64(r.histCnt[k])
		sum := atomic.LoadInt64(s)
		b.WriteString(fmt.Sprintf("%s_sum %d\n", k, sum))
		b.WriteString(fmt.Sprintf("%s_count %d\n", k, cnt))
	}
	return b.String()
}

// FiberMiddleware compte requetes + latence
func Middleware(service string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		ms := time.Since(start).Milliseconds()
		status := fmt.Sprintf("%d", c.Response().StatusCode())
		labels := map[string]string{
			"service": service,
			"method":  c.Method(),
			"path":    c.Route().Path,
			"status":  status,
		}
		Default.Inc("lami_http_requests_total", labels, 1)
		Default.ObserveMS("lami_http_request_duration_ms", map[string]string{
			"service": service,
			"method":  c.Method(),
		}, ms)
		return err
	}
}

func Handler(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/plain; version=0.0.4")
	return c.SendString(Default.Expose())
}
