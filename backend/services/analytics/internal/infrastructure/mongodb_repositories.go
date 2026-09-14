package infrastructure

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/mongodb"
)

type MongoVisitorRepository struct {
	collection *mongo.Collection
}

func NewMongoVisitorRepository(client *mongodb.Client) *MongoVisitorRepository {
	return &MongoVisitorRepository{collection: client.Collection("daily_visitors")}
}

func (r *MongoVisitorRepository) TrackVisit(ctx context.Context, date, visitorID string) (*shareddomain.DailyVisitorStats, error) {
	now := time.Now().UTC()
	filter := bson.M{"date": date}

	// Incrémente page_views toujours ; ajoute visitor_id seulement s'il est nouveau
	update := bson.M{
		"$inc": bson.M{"page_views": 1},
		"$set": bson.M{"updated_at": now},
		"$setOnInsert": bson.M{
			"_id":             uuid.New().String(),
			"date":            date,
			"unique_visitors": 0,
		},
		"$addToSet": bson.M{"visitor_ids": visitorID},
	}

	opts := options.FindOneAndUpdate().
		SetUpsert(true).
		SetReturnDocument(options.After)

	var stats shareddomain.DailyVisitorStats
	err := r.collection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&stats)
	if err != nil {
		return nil, err
	}

	// Recalcule unique_visitors = len(visitor_ids)
	unique := len(stats.VisitorIDs)
	if unique != stats.UniqueVisitors {
		_, _ = r.collection.UpdateOne(ctx, bson.M{"_id": stats.ID}, bson.M{
			"$set": bson.M{"unique_visitors": unique, "updated_at": now},
		})
		stats.UniqueVisitors = unique
	}

	return &stats, nil
}

func (r *MongoVisitorRepository) GetByDate(ctx context.Context, date string) (*shareddomain.DailyVisitorStats, error) {
	var stats shareddomain.DailyVisitorStats
	err := r.collection.FindOne(ctx, bson.M{"date": date}).Decode(&stats)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return &shareddomain.DailyVisitorStats{Date: date}, nil
		}
		return nil, err
	}
	return &stats, nil
}

func (r *MongoVisitorRepository) ListRange(ctx context.Context, fromDate, toDate string) ([]shareddomain.DailyVisitorStats, error) {
	filter := bson.M{
		"date": bson.M{"$gte": fromDate, "$lte": toDate},
	}
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}})
	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []shareddomain.DailyVisitorStats
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []shareddomain.DailyVisitorStats{}
	}
	// Ne pas exposer visitor_ids
	for i := range list {
		list[i].VisitorIDs = nil
	}
	return list, nil
}

type MongoActivityRepository struct {
	collection *mongo.Collection
}

func NewMongoActivityRepository(client *mongodb.Client) *MongoActivityRepository {
	col := client.Collection("activity_logs")
	_, _ = col.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{Keys: bson.D{{Key: "timestamp", Value: -1}}},
		{Keys: bson.D{{Key: "category", Value: 1}}},
		{Keys: bson.D{{Key: "actor_id", Value: 1}}},
	})
	return &MongoActivityRepository{collection: col}
}

func (r *MongoActivityRepository) Create(ctx context.Context, log *shareddomain.ActivityLog) error {
	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now().UTC()
	}
	_, err := r.collection.InsertOne(ctx, log)
	return err
}

func (r *MongoActivityRepository) List(ctx context.Context, page, limit int, category, actorID string) ([]shareddomain.ActivityLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 30
	}
	query := bson.M{}
	if category != "" {
		query["category"] = category
	}
	if actorID != "" {
		query["actor_id"] = actorID
	}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(int64((page - 1) * limit)).
		SetLimit(int64(limit))

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var logs []shareddomain.ActivityLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, 0, err
	}
	if logs == nil {
		logs = []shareddomain.ActivityLog{}
	}
	return logs, total, nil
}
