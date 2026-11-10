package infrastructure

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/lami-platform/services/catalog/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type MongoReviewRepository struct {
	collection *mongo.Collection
}

func NewMongoReviewRepository(db *mongo.Database) *MongoReviewRepository {
	return &MongoReviewRepository{
		collection: db.Collection("reviews"),
	}
}

func (r *MongoReviewRepository) Create(ctx context.Context, review *domain.Review) error {
	review.ID = uuid.New().String()
	review.CreatedAt = time.Now()
	_, err := r.collection.InsertOne(ctx, review)
	return err
}

func (r *MongoReviewRepository) ListByProduct(ctx context.Context, productID string) ([]domain.Review, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"product_id": productID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var reviews []domain.Review
	if err := cursor.All(ctx, &reviews); err != nil {
		return nil, err
	}
	return reviews, nil
}

func (r *MongoReviewRepository) GetAverageRating(ctx context.Context, productID string) (float64, int64, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"product_id": productID}}},
		{{Key: "$group", Value: bson.M{
			"_id":   nil,
			"avg":   bson.M{"$avg": "$rating"},
			"count": bson.M{"$sum": 1},
		}}},
	}

	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, 0, err
	}
	defer cursor.Close(ctx)

	var result []struct {
		Avg   float64 `bson:"avg"`
		Count int64   `bson:"count"`
	}

	if err := cursor.All(ctx, &result); err != nil || len(result) == 0 {
		return 0, 0, err
	}

	return result[0].Avg, result[0].Count, nil
}
