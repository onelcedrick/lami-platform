package infrastructure

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	shareddomain "github.com/lami-platform/shared/domain"
)

type CatalogClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewCatalogClient(baseURL string) *CatalogClient {
	if baseURL == "" {
		baseURL = "http://localhost:8083"
	}
	return &CatalogClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

type apiEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
}

func (c *CatalogClient) GetProduct(ctx context.Context, productID string) (*shareddomain.Product, error) {
	url := fmt.Sprintf("%s/api/v1/catalog/products/%s", c.baseURL, productID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("catalog unreachable: %w", err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("produit introuvable: %s", productID)
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("catalog HTTP %d", res.StatusCode)
	}
	var env apiEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, err
	}
	var p shareddomain.Product
	if err := json.Unmarshal(env.Data, &p); err != nil {
		return nil, err
	}
	if p.ID == "" {
		return nil, fmt.Errorf("produit invalide: %s", productID)
	}
	return &p, nil
}

func (c *CatalogClient) ListActiveDiscounts(ctx context.Context) ([]shareddomain.Discount, error) {
	url := fmt.Sprintf("%s/api/v1/catalog/discounts/active", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient.Do(req)
	if err != nil {
		// Promo non bloquante si catalog discounts down
		return []shareddomain.Discount{}, nil
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var env apiEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		return []shareddomain.Discount{}, nil
	}
	var list []shareddomain.Discount
	if err := json.Unmarshal(env.Data, &list); err != nil {
		return []shareddomain.Discount{}, nil
	}
	if list == nil {
		list = []shareddomain.Discount{}
	}
	return list, nil
}

// ResolveUnitPrice : prix catalogue + meilleure promo applicable (jamais le prix client)
func ResolveUnitPrice(product *shareddomain.Product, discounts []shareddomain.Discount) (unit float64, discountAmount float64) {
	if product == nil {
		return 0, 0
	}
	base := product.Price
	best := base
	for i := range discounts {
		d := &discounts[i]
		if !d.IsActive {
			continue
		}
		applicable := false
		switch d.Target {
		case shareddomain.DiscountTargetGlobal:
			applicable = true
		case shareddomain.DiscountTargetCategory:
			applicable = d.TargetID == product.CategoryID
		case shareddomain.DiscountTargetProduct:
			applicable = d.TargetID == product.ID
		}
		if !applicable {
			continue
		}
		p := shareddomain.ApplyDiscount(base, d)
		if p < best {
			best = p
		}
	}
	return best, base - best
}
