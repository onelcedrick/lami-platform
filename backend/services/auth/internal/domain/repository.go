package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *shareddomain.User) error
	FindByEmail(ctx context.Context, email string) (*shareddomain.User, error)
	FindByID(ctx context.Context, id string) (*shareddomain.User, error)
	Update(ctx context.Context, user *shareddomain.User) error
	UpdateLastLogin(ctx context.Context, id string) error
	EmailExists(ctx context.Context, email string) (bool, error)
}
