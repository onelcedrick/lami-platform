package domain

import (
	"time"
)

type ProductStatus string

const (
	ProductStatusActive   ProductStatus = "active"
	ProductStatusInactive ProductStatus = "inactive"
	ProductStatusDraft    ProductStatus = "draft"
	ProductStatusArchived ProductStatus = "archived"
)

type Product struct {
	ID              string                 `json:"id" bson:"_id,omitempty"`
	Name            string                 `json:"name" bson:"name"`
	Slug            string                 `json:"slug" bson:"slug"`
	Description     string                 `json:"description" bson:"description"`
	ShortDescription string                `json:"short_description,omitempty" bson:"short_description,omitempty"`
	SKU             string                 `json:"sku" bson:"sku"`
	CategoryID      string                 `json:"category_id" bson:"category_id"`
	CategoryName    string                 `json:"category_name,omitempty" bson:"category_name,omitempty"`
	Brand           string                 `json:"brand" bson:"brand"`
	Price           float64                `json:"price" bson:"price"`
	CompareAtPrice  *float64               `json:"compare_at_price,omitempty" bson:"compare_at_price,omitempty"`
	Stock           int                    `json:"stock" bson:"stock"`
	StockAlert      int                    `json:"stock_alert" bson:"stock_alert"`
	Images          []string               `json:"images" bson:"images"`
	Attributes      map[string]interface{} `json:"attributes" bson:"attributes"`
	Tags            []string               `json:"tags" bson:"tags"`
	UsageTags       []string               `json:"usage_tags" bson:"usage_tags"`
	Compatibilities []string               `json:"compatibilities,omitempty" bson:"compatibilities,omitempty"`
	Status          ProductStatus          `json:"status" bson:"status"`
	IsFeatured      bool                   `json:"is_featured" bson:"is_featured"`
	Rating          float64                `json:"rating" bson:"rating"`
	ReviewCount     int                    `json:"review_count" bson:"review_count"`
	SalesCount      int                    `json:"sales_count" bson:"sales_count"`
	ViewCount       int                    `json:"view_count" bson:"view_count"`
	PopularityScore float64                `json:"popularity_score,omitempty" bson:"popularity_score,omitempty"`
	CreatedAt       time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at" bson:"updated_at"`
}

type Category struct {
	ID          string     `json:"id" bson:"_id,omitempty"`
	Name        string     `json:"name" bson:"name"`
	Slug        string     `json:"slug" bson:"slug"`
	Description string     `json:"description,omitempty" bson:"description,omitempty"`
	ParentID    *string    `json:"parent_id,omitempty" bson:"parent_id,omitempty"`
	ImageURL    string     `json:"image_url,omitempty" bson:"image_url,omitempty"`
	Order       int        `json:"order" bson:"order"`
	IsActive    bool       `json:"is_active" bson:"is_active"`
	CreatedAt   time.Time  `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" bson:"updated_at"`
	Children    []Category `json:"children,omitempty" bson:"-"`
}

type CreateProductRequest struct {
	Name             string                 `json:"name" validate:"required"`
	Description      string                 `json:"description" validate:"required"`
	ShortDescription string                 `json:"short_description,omitempty"`
	SKU              string                 `json:"sku" validate:"required"`
	CategoryID       string                 `json:"category_id" validate:"required"`
	Brand            string                 `json:"brand" validate:"required"`
	Price            float64                `json:"price" validate:"required,gt=0"`
	CompareAtPrice   *float64               `json:"compare_at_price,omitempty"`
	Stock            int                    `json:"stock" validate:"gte=0"`
	StockAlert       int                    `json:"stock_alert"`
	Images           []string               `json:"images"`
	Attributes       map[string]interface{} `json:"attributes"`
	Tags             []string               `json:"tags"`
	UsageTags        []string               `json:"usage_tags"`
	Compatibilities  []string               `json:"compatibilities"`
	IsFeatured       bool                   `json:"is_featured"`
}

type ProductFilter struct {
	CategoryID string   `json:"category_id,omitempty"`
	Brand      string   `json:"brand,omitempty"`
	MinPrice   *float64 `json:"min_price,omitempty"`
	MaxPrice   *float64 `json:"max_price,omitempty"`
	Tags       []string `json:"tags,omitempty"`
	UsageTags  []string `json:"usage_tags,omitempty"`
	Search     string   `json:"search,omitempty"`
	Status     string   `json:"status,omitempty"`
	IsFeatured *bool    `json:"is_featured,omitempty"`
	Page       int      `json:"page"`
	Limit      int      `json:"limit"`
	SortBy     string   `json:"sort_by"`
	SortOrder  string   `json:"sort_order"`
}

// --- Promotions / Remises ---

type DiscountType string

const (
	DiscountTypePercentage  DiscountType = "percentage"
	DiscountTypeFixedAmount DiscountType = "fixed_amount"
)

type DiscountTarget string

const (
	DiscountTargetGlobal   DiscountTarget = "global"
	DiscountTargetCategory DiscountTarget = "category"
	DiscountTargetProduct  DiscountTarget = "product"
)

type Discount struct {
	ID          string         `json:"id" bson:"_id,omitempty"`
	Name        string         `json:"name" bson:"name"`
	Type        DiscountType   `json:"type" bson:"type"` // percentage | fixed_amount
	Value       float64        `json:"value" bson:"value"`
	Target      DiscountTarget `json:"target" bson:"target"` // global | category | product
	TargetID    string         `json:"target_id,omitempty" bson:"target_id,omitempty"`
	TargetLabel string         `json:"target_label,omitempty" bson:"target_label,omitempty"`
	IsActive    bool           `json:"is_active" bson:"is_active"`
	StartsAt    *time.Time     `json:"starts_at,omitempty" bson:"starts_at,omitempty"`
	EndsAt      *time.Time     `json:"ends_at,omitempty" bson:"ends_at,omitempty"`
	CreatedAt   time.Time      `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" bson:"updated_at"`
}

type CreateDiscountRequest struct {
	Name        string  `json:"name" validate:"required"`
	Type        string  `json:"type" validate:"required"` // percentage | fixed_amount
	Value       float64 `json:"value" validate:"required,gt=0"`
	Target      string  `json:"target" validate:"required"` // global | category | product
	TargetID    string  `json:"target_id,omitempty"`
	TargetLabel string  `json:"target_label,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
}

// ApplyDiscount calcule le prix remisé (jamais negatif)
func ApplyDiscount(price float64, d *Discount) float64 {
	if d == nil || !d.IsActive || price <= 0 {
		return price
	}
	var result float64
	switch d.Type {
	case DiscountTypePercentage:
		result = price * (1 - d.Value/100)
	case DiscountTypeFixedAmount:
		result = price - d.Value
	default:
		return price
	}
	if result < 0 {
		return 0
	}
	return result
}
