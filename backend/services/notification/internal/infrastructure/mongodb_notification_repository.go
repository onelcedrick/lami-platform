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

type MongoNotificationRepository struct {
	collection *mongo.Collection
}

func NewMongoNotificationRepository(client *mongodb.Client) *MongoNotificationRepository {
	return &MongoNotificationRepository{collection: client.Collection("notifications")}
}

func (r *MongoNotificationRepository) Create(ctx context.Context, n *shareddomain.Notification) error {
	_, err := r.collection.InsertOne(ctx, n)
	return err
}

func (r *MongoNotificationRepository) FindByID(ctx context.Context, id string) (*shareddomain.Notification, error) {
	var n shareddomain.Notification
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&n)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("notification introuvable")
		}
		return nil, err
	}
	return &n, nil
}

func (r *MongoNotificationRepository) FindByUserID(ctx context.Context, userID string, page, limit int, unreadOnly bool) ([]shareddomain.Notification, int64, error) {
	query := bson.M{"user_id": userID}
	if unreadOnly {
		query["status"] = bson.M{"$ne": shareddomain.NotificationStatusRead}
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

	var list []shareddomain.Notification
	if err := cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	if list == nil {
		list = []shareddomain.Notification{}
	}
	return list, total, nil
}

func (r *MongoNotificationRepository) MarkAsRead(ctx context.Context, id, userID string) error {
	now := time.Now().UTC()
	res, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": id, "user_id": userID},
		bson.M{"$set": bson.M{
			"status":     shareddomain.NotificationStatusRead,
			"read_at":    now,
			"updated_at": now,
		}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("notification introuvable")
	}
	return nil
}

func (r *MongoNotificationRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	now := time.Now().UTC()
	_, err := r.collection.UpdateMany(ctx,
		bson.M{"user_id": userID, "status": bson.M{"$ne": shareddomain.NotificationStatusRead}},
		bson.M{"$set": bson.M{
			"status":     shareddomain.NotificationStatusRead,
			"read_at":    now,
			"updated_at": now,
		}},
	)
	return err
}

func (r *MongoNotificationRepository) UpdateStatus(ctx context.Context, id string, status shareddomain.NotificationStatus) error {
	update := bson.M{"status": status, "updated_at": time.Now().UTC()}
	if status == shareddomain.NotificationStatusSent {
		now := time.Now().UTC()
		update["sent_at"] = now
	}
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": update})
	return err
}

func (r *MongoNotificationRepository) CountUnread(ctx context.Context, userID string) (int64, error) {
	return r.collection.CountDocuments(ctx, bson.M{
		"user_id": userID,
		"status":  bson.M{"$ne": shareddomain.NotificationStatusRead},
	})
}
