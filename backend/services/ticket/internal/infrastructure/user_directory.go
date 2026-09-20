package infrastructure

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/lami-platform/services/ticket/internal/application"
)

// HTTPUserDirectory interroge le service user via l'API interne
type HTTPUserDirectory struct {
	baseURL string
	client  *http.Client
}

func NewHTTPUserDirectory() *HTTPUserDirectory {
	base := os.Getenv("USER_SERVICE_URL")
	if base == "" {
		base = "http://user-service:8082"
	}
	return &HTTPUserDirectory{
		baseURL: base,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (d *HTTPUserDirectory) ListTechnicians(ctx context.Context) ([]application.TechnicianInfo, error) {
	url := fmt.Sprintf("%s/api/v1/users?role=technician&limit=100", d.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	// Header interne : à sécuriser en prod
	req.Header.Set("X-Internal-Service", "ticket-service")

	resp, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user-service HTTP %d", resp.StatusCode)
	}

	// Format attendu : { success: true, data: [ {...} ] }
	var raw struct {
		Success bool `json:"success"`
		Data    []struct {
			ID        string `json:"id"`
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Email     string `json:"email"`
			Role      string `json:"role"`
			IsActive  bool   `json:"is_active"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	out := make([]application.TechnicianInfo, 0, len(raw.Data))
	for _, u := range raw.Data {
		if u.IsActive {
			out = append(out, application.TechnicianInfo{
				ID:        u.ID,
				FirstName: u.FirstName,
				LastName:  u.LastName,
				Email:     u.Email,
			})
		}
	}
	return out, nil
}