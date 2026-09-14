package mongodb

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

type Client struct {
	Client   *mongo.Client
	Database *mongo.Database
}

func Connect(uri, dbName string) (*Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, err
	}

	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return nil, err
	}

	log.Info().Str("database", dbName).Msg("Connexion MongoDB etablie")

	return &Client{
		Client:   client,
		Database: client.Database(dbName),
	}, nil
}

func (c *Client) Collection(name string) *mongo.Collection {
	return c.Database.Collection(name)
}

func (c *Client) Disconnect(ctx context.Context) error {
	return c.Client.Disconnect(ctx)
}
