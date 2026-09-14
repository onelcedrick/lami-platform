package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

type Client struct {
	conn *amqp.Connection
	ch   *amqp.Channel
	url  string
}

func Connect(url string) (*Client, error) {
	if url == "" {
		url = "amqp://guest:guest@localhost:5672/"
	}
	var conn *amqp.Connection
	var err error
	// Retry connection (Rabbit may start after services)
	for i := 0; i < 10; i++ {
		conn, err = amqp.Dial(url)
		if err == nil {
			break
		}
		logger.Warn().Err(err).Int("attempt", i+1).Msg("RabbitMQ indisponible, nouvel essai...")
		time.Sleep(time.Duration(i+1) * time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("rabbitmq: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		return nil, err
	}
	if err := ch.ExchangeDeclare(
		events.ExchangeName,
		events.ExchangeType,
		true,  // durable
		false, // auto-delete
		false,
		false,
		nil,
	); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, err
	}
	logger.Info().Str("url", url).Msg("RabbitMQ connecte")
	return &Client{conn: conn, ch: ch, url: url}, nil
}

func (c *Client) Close() {
	if c.ch != nil {
		_ = c.ch.Close()
	}
	if c.conn != nil {
		_ = c.conn.Close()
	}
}

func (c *Client) Publish(ctx context.Context, routingKey string, payload any) error {
	if c == nil || c.ch == nil {
		return fmt.Errorf("rabbitmq non initialise")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.ch.PublishWithContext(ctx,
		events.ExchangeName,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now().UTC(),
			Body:         body,
		},
	)
}

type Handler func(ctx context.Context, routingKey string, body []byte) error

// Subscribe declare une queue durable, bind, et consomme en boucle.
func (c *Client) Subscribe(queueName string, routingKeys []string, handler Handler) error {
	if c == nil || c.ch == nil {
		return fmt.Errorf("rabbitmq non initialise")
	}
	_, err := c.ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return err
	}
	for _, rk := range routingKeys {
		if err := c.ch.QueueBind(queueName, rk, events.ExchangeName, false, nil); err != nil {
			return err
		}
	}
	if err := c.ch.Qos(1, 0, false); err != nil {
		return err
	}
	deliveries, err := c.ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	go func() {
		for d := range deliveries {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			err := handler(ctx, d.RoutingKey, d.Body)
			cancel()
			if err != nil {
				logger.Error().Err(err).Str("queue", queueName).Str("rk", d.RoutingKey).Msg("Handler evenement echec")
				_ = d.Nack(false, true) // requeue
			} else {
				_ = d.Ack(false)
			}
		}
	}()
	logger.Info().Str("queue", queueName).Strs("keys", routingKeys).Msg("Consumer RabbitMQ demarre")
	return nil
}
