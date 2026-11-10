package domain

import (
	"context"
	"time"
)

type Review struct {
	ID        string    `json:"id" bson:"_id"`
	ProductID string    `json:"product_id" bson:"product_id"`
	UserID    string    `json:"user_id" bson:"user_id"`
	UserName  string    `json:"user_name" bson:"user_name"`
	Rating    int       `json:"rating" bson:"rating"`
	Comment   string    `json:"comment" bson:"comment"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

type ReviewRepository interface {
	Create(ctx context.Context, review *Review) error
	ListByProduct(ctx context.Context, productID string) ([]Review, error)
	GetAverageRating(ctx context.Context, productID string) (float64, int64, error)
}
