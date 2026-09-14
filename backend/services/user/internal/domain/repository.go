package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *shareddomain.User) error
	FindByID(ctx context.Context, id string) (*shareddomain.User, error)
	FindByEmail(ctx context.Context, email string) (*shareddomain.User, error)
	Update(ctx context.Context, user *shareddomain.User) error
	List(ctx context.Context, page, limit int, role, search string, activeOnly *bool) ([]shareddomain.User, int64, error)
	Delete(ctx context.Context, id string) error
	CountByRole(ctx context.Context) (map[string]int64, error)
	GetSettings(ctx context.Context) (*shareddomain.ShopSettings, error)
	SaveSettings(ctx context.Context, st *shareddomain.ShopSettings) error
}
