package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type ProductRepository interface {
	Create(ctx context.Context, product *shareddomain.Product) error
	FindByID(ctx context.Context, id string) (*shareddomain.Product, error)
	FindBySlug(ctx context.Context, slug string) (*shareddomain.Product, error)
	Update(ctx context.Context, product *shareddomain.Product) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, filter shareddomain.ProductFilter) ([]shareddomain.Product, int64, error)
	FindByCategory(ctx context.Context, categoryID string, page, limit int) ([]shareddomain.Product, int64, error)
	IncrementViews(ctx context.Context, id string) error
	IncrementSales(ctx context.Context, id string, qty int) error
	DecrementStock(ctx context.Context, id string, qty int) error
	IncrementStock(ctx context.Context, id string, qty int) error
	ListByPopularity(ctx context.Context, limit int) ([]shareddomain.Product, error)
}


type CategoryRepository interface {
	Create(ctx context.Context, category *shareddomain.Category) error
	FindByID(ctx context.Context, id string) (*shareddomain.Category, error)
	FindBySlug(ctx context.Context, slug string) (*shareddomain.Category, error)
	Update(ctx context.Context, category *shareddomain.Category) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context) ([]shareddomain.Category, error)
	ListTree(ctx context.Context) ([]shareddomain.Category, error)
}

type DiscountRepository interface {
	Create(ctx context.Context, d *shareddomain.Discount) error
	FindByID(ctx context.Context, id string) (*shareddomain.Discount, error)
	Update(ctx context.Context, d *shareddomain.Discount) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context) ([]shareddomain.Discount, error)
	ListActive(ctx context.Context) ([]shareddomain.Discount, error)
}
