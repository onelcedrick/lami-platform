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

type MongoOrderRepository struct {
	collection *mongo.Collection
}

func NewMongoOrderRepository(client *mongodb.Client) *MongoOrderRepository {
	return &MongoOrderRepository{collection: client.Collection("orders")}
}

func (r *MongoOrderRepository) Create(ctx context.Context, order *shareddomain.Order) error {
	_, err := r.collection.InsertOne(ctx, order)
	return err
}

func (r *MongoOrderRepository) FindByID(ctx context.Context, id string) (*shareddomain.Order, error) {
	var order shareddomain.Order
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&order)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("commande introuvable")
		}
		return nil, err
	}
	return &order, nil
}

func (r *MongoOrderRepository) FindByOrderNumber(ctx context.Context, orderNumber string) (*shareddomain.Order, error) {
	var order shareddomain.Order
	err := r.collection.FindOne(ctx, bson.M{"order_number": orderNumber}).Decode(&order)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("commande introuvable")
		}
		return nil, err
	}
	return &order, nil
}

func (r *MongoOrderRepository) FindByUserID(ctx context.Context, userID string, page, limit int) ([]shareddomain.Order, int64, error) {
	query := bson.M{"user_id": userID}
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

	var orders []shareddomain.Order
	if err := cursor.All(ctx, &orders); err != nil {
		return nil, 0, err
	}
	if orders == nil {
		orders = []shareddomain.Order{}
	}
	return orders, total, nil
}

func (r *MongoOrderRepository) Update(ctx context.Context, order *shareddomain.Order) error {
	order.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": order.ID}, order)
	return err
}

func (r *MongoOrderRepository) UpdateStatus(ctx context.Context, id string, status shareddomain.OrderStatus, paymentStatus shareddomain.PaymentStatus) error {
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now().UTC(),
		},
	}
	if paymentStatus != "" {
		update["$set"].(bson.M)["payment_status"] = paymentStatus
	}
	res, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("commande introuvable")
	}
	return nil
}

func (r *MongoOrderRepository) List(ctx context.Context, page, limit int, status string) ([]shareddomain.Order, int64, error) {
	query := bson.M{}
	if status != "" {
		query["status"] = status
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

	var orders []shareddomain.Order
	if err := cursor.All(ctx, &orders); err != nil {
		return nil, 0, err
	}
	if orders == nil {
		orders = []shareddomain.Order{}
	}
	return orders, total, nil
}

func (r *MongoOrderRepository) GetStats(ctx context.Context, days int) (*shareddomain.OrderStats, error) {
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	stats := &shareddomain.OrderStats{
		Currency:        "MGA",
		ByPaymentMethod: map[string]int64{},
		ByStatus:        map[string]int64{},
		DailyRevenue:    []shareddomain.DailyRevenuePoint{},
		TopProducts:     []shareddomain.ProductSalesPoint{},
	}

	// Totaux globaux
	total, _ := r.collection.CountDocuments(ctx, bson.M{})
	stats.TotalOrders = total
	pending, _ := r.collection.CountDocuments(ctx, bson.M{"status": "pending"})
	stats.PendingOrders = pending
	paid, _ := r.collection.CountDocuments(ctx, bson.M{"payment_status": "paid"})
	stats.PaidOrders = paid
	cancelled, _ := r.collection.CountDocuments(ctx, bson.M{"status": "cancelled"})
	stats.CancelledOrders = cancelled

	// Revenue paye
	pipePaid := []bson.M{
		{"$match": bson.M{"payment_status": "paid"}},
		{"$group": bson.M{"_id": nil, "sum": bson.M{"$sum": "$total"}, "count": bson.M{"$sum": 1}}},
	}
	cur, err := r.collection.Aggregate(ctx, pipePaid)
	if err == nil {
		var rows []bson.M
		_ = cur.All(ctx, &rows)
		if len(rows) > 0 {
			if v, ok := rows[0]["sum"].(float64); ok {
				stats.RevenuePaid = v
			}
			if v, ok := rows[0]["count"].(int32); ok && v > 0 {
				stats.AverageOrderValue = stats.RevenuePaid / float64(v)
			} else if v, ok := rows[0]["count"].(int64); ok && v > 0 {
				stats.AverageOrderValue = stats.RevenuePaid / float64(v)
			}
		}
		_ = cur.Close(ctx)
	}

	pipePending := []bson.M{
		{"$match": bson.M{"payment_status": "pending", "status": bson.M{"$ne": "cancelled"}}},
		{"$group": bson.M{"_id": nil, "sum": bson.M{"$sum": "$total"}}},
	}
	cur2, err := r.collection.Aggregate(ctx, pipePending)
	if err == nil {
		var rows []bson.M
		_ = cur2.All(ctx, &rows)
		if len(rows) > 0 {
			if v, ok := rows[0]["sum"].(float64); ok {
				stats.RevenuePending = v
			}
		}
		_ = cur2.Close(ctx)
	}

	// Par statut
	pipeStatus := []bson.M{
		{"$group": bson.M{"_id": "$status", "count": bson.M{"$sum": 1}}},
	}
	cur3, err := r.collection.Aggregate(ctx, pipeStatus)
	if err == nil {
		var rows []bson.M
		_ = cur3.All(ctx, &rows)
		for _, row := range rows {
			id, _ := row["_id"].(string)
			switch c := row["count"].(type) {
			case int32:
				stats.ByStatus[id] = int64(c)
			case int64:
				stats.ByStatus[id] = c
			}
		}
		_ = cur3.Close(ctx)
	}

	// Par moyen de paiement
	pipePay := []bson.M{
		{"$group": bson.M{"_id": "$payment_method", "count": bson.M{"$sum": 1}}},
	}
	cur4, err := r.collection.Aggregate(ctx, pipePay)
	if err == nil {
		var rows []bson.M
		_ = cur4.All(ctx, &rows)
		for _, row := range rows {
			id, _ := row["_id"].(string)
			if id == "" {
				id = "inconnu"
			}
			switch c := row["count"].(type) {
			case int32:
				stats.ByPaymentMethod[id] = int64(c)
			case int64:
				stats.ByPaymentMethod[id] = c
			}
		}
		_ = cur4.Close(ctx)
	}

	// CA journalier (N derniers jours)
	from := time.Now().UTC().AddDate(0, 0, -days)
	pipeDaily := []bson.M{
		{"$match": bson.M{
			"payment_status": "paid",
			"created_at":     bson.M{"$gte": from},
		}},
		{"$group": bson.M{
			"_id":     bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$created_at"}},
			"orders":  bson.M{"$sum": 1},
			"revenue": bson.M{"$sum": "$total"},
		}},
		{"$sort": bson.M{"_id": 1}},
	}
	cur5, err := r.collection.Aggregate(ctx, pipeDaily)
	if err == nil {
		var rows []bson.M
		_ = cur5.All(ctx, &rows)
		for _, row := range rows {
			pt := shareddomain.DailyRevenuePoint{}
			pt.Date, _ = row["_id"].(string)
			switch o := row["orders"].(type) {
			case int32:
				pt.Orders = int64(o)
			case int64:
				pt.Orders = o
			}
			if v, ok := row["revenue"].(float64); ok {
				pt.Revenue = v
			}
			stats.DailyRevenue = append(stats.DailyRevenue, pt)
		}
		_ = cur5.Close(ctx)
	}

	// Top produits
	pipeTop := []bson.M{
		{"$match": bson.M{"payment_status": "paid"}},
		{"$unwind": "$items"},
		{"$group": bson.M{
			"_id":   "$items.product_id",
			"name":  bson.M{"$first": "$items.product_name"},
			"qty":   bson.M{"$sum": "$items.quantity"},
			"rev":   bson.M{"$sum": "$items.total_price"},
		}},
		{"$sort": bson.M{"qty": -1}},
		{"$limit": 10},
	}
	cur6, err := r.collection.Aggregate(ctx, pipeTop)
	if err == nil {
		var rows []bson.M
		_ = cur6.All(ctx, &rows)
		for _, row := range rows {
			pt := shareddomain.ProductSalesPoint{}
			pt.ProductID, _ = row["_id"].(string)
			pt.ProductName, _ = row["name"].(string)
			switch q := row["qty"].(type) {
			case int32:
				pt.Quantity = int64(q)
			case int64:
				pt.Quantity = q
			}
			if v, ok := row["rev"].(float64); ok {
				pt.Revenue = v
			}
			stats.TopProducts = append(stats.TopProducts, pt)
		}
		_ = cur6.Close(ctx)
	}

	return stats, nil
}
