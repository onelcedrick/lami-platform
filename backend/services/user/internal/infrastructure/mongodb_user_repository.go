package infrastructure

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/mongodb"
)

type MongoUserRepository struct {
	collection *mongo.Collection
}

func NewMongoUserRepository(client *mongodb.Client) *MongoUserRepository {
	return &MongoUserRepository{collection: client.Collection("users")}
}

func (r *MongoUserRepository) Create(ctx context.Context, user *shareddomain.User) error {
	_, err := r.collection.InsertOne(ctx, user)
	return err
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

func (r *MongoUserRepository) Update(ctx context.Context, user *shareddomain.User) error {
	user.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": user.ID}, user)
	return err
}

func (r *MongoUserRepository) List(ctx context.Context, page, limit int, role, search string, activeOnly *bool) ([]shareddomain.User, int64, error) {
	query := bson.M{}
	if role != "" {
		query["role"] = role
	}
	if activeOnly != nil {
		query["is_active"] = *activeOnly
	}
	if search != "" {
		query["$or"] = []bson.M{
			{"email": bson.M{"$regex": search, "$options": "i"}},
			{"first_name": bson.M{"$regex": search, "$options": "i"}},
			{"last_name": bson.M{"$regex": search, "$options": "i"}},
			{"phone": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var users []shareddomain.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, 0, err
	}
	if users == nil {
		users = []shareddomain.User{}
	}
	return users, total, nil
}

func (r *MongoUserRepository) Delete(ctx context.Context, id string) error {
	res, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errors.New("utilisateur introuvable")
	}
	return nil
}

func (r *MongoUserRepository) CountByRole(ctx context.Context) (map[string]int64, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.M{"_id": "$role", "count": bson.M{"$sum": 1}}}},
	}
	cursor, err := r.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	result := map[string]int64{
		"client": 0, "technician": 0, "admin": 0, "super_admin": 0, "total": 0,
	}
	var rows []struct {
		ID    string `bson:"_id"`
		Count int64  `bson:"count"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ID] = row.Count
		result["total"] += row.Count
	}
	return result, nil
}

func (r *MongoUserRepository) settingsCol() *mongo.Collection {
	return r.collection.Database().Collection("shop_settings")
}

func (r *MongoUserRepository) GetSettings(ctx context.Context) (*shareddomain.ShopSettings, error) {
	var st shareddomain.ShopSettings
	err := r.settingsCol().FindOne(ctx, bson.M{"_id": "shop"}).Decode(&st)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

func (r *MongoUserRepository) SaveSettings(ctx context.Context, st *shareddomain.ShopSettings) error {
	st.ID = "shop"
	_, err := r.settingsCol().UpdateOne(ctx,
		bson.M{"_id": "shop"},
		bson.M{"$set": st},
		options.Update().SetUpsert(true),
	)
	return err
}
