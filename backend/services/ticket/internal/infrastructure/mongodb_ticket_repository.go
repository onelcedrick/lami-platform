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

type MongoTicketRepository struct {
	collection *mongo.Collection
}

func NewMongoTicketRepository(client *mongodb.Client) *MongoTicketRepository {
	return &MongoTicketRepository{collection: client.Collection("tickets")}
}

func (r *MongoTicketRepository) Create(ctx context.Context, ticket *shareddomain.Ticket) error {
	_, err := r.collection.InsertOne(ctx, ticket)
	return err
}

func (r *MongoTicketRepository) FindByID(ctx context.Context, id string) (*shareddomain.Ticket, error) {
	var t shareddomain.Ticket
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&t)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("ticket introuvable")
		}
		return nil, err
	}
	return &t, nil
}

func (r *MongoTicketRepository) FindByTicketNumber(ctx context.Context, number string) (*shareddomain.Ticket, error) {
	var t shareddomain.Ticket
	err := r.collection.FindOne(ctx, bson.M{"ticket_number": number}).Decode(&t)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("ticket introuvable")
		}
		return nil, err
	}
	return &t, nil
}

func (r *MongoTicketRepository) FindByUserID(ctx context.Context, userID string, page, limit int) ([]shareddomain.Ticket, int64, error) {
	return r.findWithQuery(ctx, bson.M{"user_id": userID}, page, limit)
}

func (r *MongoTicketRepository) FindByAssignee(ctx context.Context, assigneeID string, page, limit int) ([]shareddomain.Ticket, int64, error) {
	return r.findWithQuery(ctx, bson.M{"assigned_to": assigneeID}, page, limit)
}

func (r *MongoTicketRepository) List(ctx context.Context, page, limit int, status, priority, category string) ([]shareddomain.Ticket, int64, error) {
	query := bson.M{}
	if status != "" {
		query["status"] = status
	}
	if priority != "" {
		query["priority"] = priority
	}
	if category != "" {
		query["category"] = category
	}
	return r.findWithQuery(ctx, query, page, limit)
}

func (r *MongoTicketRepository) findWithQuery(ctx context.Context, query bson.M, page, limit int) ([]shareddomain.Ticket, int64, error) {
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

	var tickets []shareddomain.Ticket
	if err := cursor.All(ctx, &tickets); err != nil {
		return nil, 0, err
	}
	if tickets == nil {
		tickets = []shareddomain.Ticket{}
	}
	return tickets, total, nil
}

func (r *MongoTicketRepository) Update(ctx context.Context, ticket *shareddomain.Ticket) error {
	ticket.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": ticket.ID}, ticket)
	return err
}

func (r *MongoTicketRepository) AddMessage(ctx context.Context, ticketID string, msg shareddomain.TicketMessage) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": ticketID}, bson.M{
		"$push": bson.M{"messages": msg},
		"$set":  bson.M{"updated_at": time.Now().UTC()},
	})
	return err
}

func (r *MongoTicketRepository) AddInternalNote(ctx context.Context, ticketID string, note shareddomain.TicketNote) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": ticketID}, bson.M{
		"$push": bson.M{"internal_notes": note},
		"$set":  bson.M{"updated_at": time.Now().UTC()},
	})
	return err
}
