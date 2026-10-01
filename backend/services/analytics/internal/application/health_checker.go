package application

import (
	"context"
	"net/http"
	"sync"
	"time"
)

// ServiceHealth represente l'etat d'un service.
type ServiceHealth struct {
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Status    string    `json:"status"`
	LatencyMs int       `json:"latency_ms"`
	LastCheck time.Time `json:"last_check"`
	Error     string    `json:"error,omitempty"`
}

// HealthChecker ping tous les services L'AMI.
type HealthChecker struct {
	mu       sync.RWMutex
	services map[string]string
	state    map[string]ServiceHealth
	hub      *LiveHub
}

func NewHealthChecker(hub *LiveHub) *HealthChecker {
	return &HealthChecker{
		services: map[string]string{
			"gateway":      "http://api-gateway:8000/health",
			"auth":         "http://auth-service:8081/health",
			"user":         "http://user-service:8082/health",
			"catalog":      "http://catalog-service:8083/health",
			"order":        "http://order-service:8084/health",
			"ticket":       "http://ticket-service:8085/health",
			"notification": "http://notification-service:8086/health",
			"analytics":    "http://analytics-service:8087/health",
			"ia":           "http://ia-service:8090/api/v1/ia/health",
		},
		state: make(map[string]ServiceHealth),
		hub:   hub,
	}
}

// Snapshot retourne l'etat actuel de tous les services.
func (h *HealthChecker) Snapshot() []ServiceHealth {
	h.mu.RLock()
	defer h.mu.RUnlock()
	result := make([]ServiceHealth, 0, len(h.state))
	for _, s := range h.state {
		result = append(result, s)
	}
	return result
}

// Run lance la boucle de ping (toutes les 10s).
func (h *HealthChecker) Run(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	h.checkAll(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.checkAll(ctx)
		}
	}
}

func (h *HealthChecker) checkAll(ctx context.Context) {
	var wg sync.WaitGroup
	for name, url := range h.services {
		wg.Add(1)
		go func(n, u string) {
			defer wg.Done()
			h.checkOne(ctx, n, u)
		}(name, url)
	}
	wg.Wait()
}

func (h *HealthChecker) checkOne(ctx context.Context, name, url string) {
	start := time.Now()
	status := "healthy"
	errMsg := ""

	checkCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, _ := http.NewRequestWithContext(checkCtx, "GET", url, nil)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		status = "down"
		errMsg = err.Error()
	} else {
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			status = "degraded"
			errMsg = "HTTP " + resp.Status
		} else if latency > 2000 {
			status = "degraded"
			errMsg = "latence elevee"
		}
	}

	health := ServiceHealth{
		Name:      name,
		URL:       url,
		Status:    status,
		LatencyMs: latency,
		LastCheck: time.Now().UTC(),
		Error:     errMsg,
	}

	h.mu.Lock()
	h.state[name] = health
	h.mu.Unlock()

	if status != "healthy" && h.hub != nil {
		h.hub.PublishError("health:"+name, name+" est "+status)
	}
}
