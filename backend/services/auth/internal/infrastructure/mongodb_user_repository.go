package infrastructure

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/mongodb"
)

type MongoUserRepository struct {
	collection *mongo.Collection
}

func NewMongoUserRepository(client *mongodb.Client) *MongoUserRepository {
	return &MongoUserRepository{
		collection: client.Collection("users"),
	}
}

func (r *MongoUserRepository) Create(ctx context.Context, user *shareddomain.User) error {
	_, err := r.collection.InsertOne(ctx, user)
	return err
}

func (r *MongoUserRepository) FindByEmail(ctx context.Context, email string) (*shareddomain.User, error) {
	var user shareddomain.User
	err := r.collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("utilisateur introuvable")
		}
		return nil, err
	}
	return &user, nil
}

func (r *MongoUserRepository) FindByID(ctx context.Context, id string) (*shareddomain.User, error) {
	var user shareddomain.User
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("utilisateur introuvable")
		}
		return nil, err
	}
	return &user, nil
}

func (r *MongoUserRepository) Update(ctx context.Context, user *shareddomain.User) error {
	user.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": user.ID}, user)
	return err
}

func (r *MongoUserRepository) UpdateLastLogin(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$set": bson.M{"last_login_at": now, "updated_at": now},
	})
	return err
}

func (r *MongoUserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	count, err := r.collection.CountDocuments(ctx, bson.M{"email": email})
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
