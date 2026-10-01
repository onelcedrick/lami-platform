package application

import (
	"context"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// KPISnapshot represente les KPIs temps reel.
type KPISnapshot struct {
	Timestamp      time.Time `json:"timestamp"`
	CAJour         float64   `json:"ca_jour_mga"`
	CommandesJour  int       `json:"commandes_jour"`
	VisiteursJour  int       `json:"visiteurs_jour"`
	TicketsOuverts int       `json:"tickets_ouverts"`
	PanierMoyen    float64   `json:"panier_moyen_mga"`
	IAChatsJour    int       `json:"ia_chats_jour"`
	IALatenceP50   int       `json:"ia_latence_p50_ms"`
}

// KPIAggregator calcule les KPIs depuis MongoDB.
type KPIAggregator struct {
	analyticsDB *mongo.Database
	orderDB     *mongo.Database
	ticketDB    *mongo.Database
	iaDB        *mongo.Database
}

func NewKPIAggregator(analyticsDB, orderDB, ticketDB, iaDB *mongo.Database) *KPIAggregator {
	return &KPIAggregator{
		analyticsDB: analyticsDB,
		orderDB:     orderDB,
		ticketDB:    ticketDB,
		iaDB:        iaDB,
	}
}

func (k *KPIAggregator) Snapshot(ctx context.Context) (*KPISnapshot, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	snap := &KPISnapshot{Timestamp: time.Now().UTC()}

	// CA du jour + nb commandes payees
	if k.orderDB != nil {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.M{
				"payment_status": "paid",
				"paid_at":        bson.M{"$gte": today},
			}}},
			{{Key: "$group", Value: bson.M{
				"_id":   nil,
				"total": bson.M{"$sum": "$total"},
				"count": bson.M{"$sum": 1},
			}}},
		}
		cursor, err := k.orderDB.Collection("orders").Aggregate(ctx, pipeline)
		if err == nil {
			defer cursor.Close(ctx)
			var result struct {
				Total float64 `bson:"total"`
				Count int     `bson:"count"`
			}
			if cursor.Next(ctx) {
				_ = cursor.Decode(&result)
				snap.CAJour = result.Total
				snap.CommandesJour = result.Count
				if result.Count > 0 {
					snap.PanierMoyen = result.Total / float64(result.Count)
				}
			}
		}
	}

	// Visiteurs du jour
	if k.analyticsDB != nil {
		dateStr := time.Now().UTC().Format("2006-01-02")
		var visitor struct {
			UniqueVisitors int `bson:"unique_visitors"`
		}
		err := k.analyticsDB.Collection("daily_visitors").FindOne(ctx,
			bson.M{"date": dateStr}).Decode(&visitor)
		if err == nil {
			snap.VisiteursJour = visitor.UniqueVisitors
		}
	}

	// Tickets ouverts
	if k.ticketDB != nil {
		count, err := k.ticketDB.Collection("tickets").CountDocuments(ctx, bson.M{
			"status": bson.M{"$in": []string{"open", "in_progress"}},
		})
		if err == nil {
			snap.TicketsOuverts = int(count)
		}
	}

	// Chats IA + latence p50
	if k.iaDB != nil {
		cursor, err := k.iaDB.Collection("messages").Find(ctx, bson.M{
			"role":       "assistant",
			"created_at": bson.M{"$gte": today},
		})
		if err == nil {
			defer cursor.Close(ctx)
			var latencies []int
			for cursor.Next(ctx) {
				var msg struct {
					LatencyMs int `bson:"latency_ms"`
				}
				if err := cursor.Decode(&msg); err == nil && msg.LatencyMs > 0 {
					latencies = append(latencies, msg.LatencyMs)
				}
			}
			snap.IAChatsJour = len(latencies)
			if len(latencies) > 0 {
				snap.IALatenceP50 = percentile(latencies, 50)
			}
		}
	}

	return snap, nil
}

func percentile(values []int, p int) int {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]int, len(values))
	copy(sorted, values)
	sort.Ints(sorted)
	idx := (len(sorted) - 1) * p / 100
	return sorted[idx]
}
