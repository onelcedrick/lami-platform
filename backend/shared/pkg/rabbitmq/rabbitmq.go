package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/lami-platform/shared/pkg/events"
	"github.com/lami-platform/shared/pkg/logger"
)

// Client est un wrapper optimise pour RabbitMQ.
// - Publisher confirms (garantir la livraison)
// - Dead Letter Queue (messages en erreur)
// - Prefetch configurable (parallélisation)
// - Retry avec backoff exponentiel
type Client struct {
	conn *amqp.Connection
	ch   *amqp.Channel
	url  string

	// Publisher confirms
	confirmMode bool
	confirmMu   sync.Mutex
	confirmCh   chan amqp.Confirmation
}

func Connect(url string) (*Client, error) {
	if url == "" {
		url = "amqp://guest:guest@localhost:5672/"
	}
	var conn *amqp.Connection
	var err error
	// Retry connection
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

	// Declare exchange
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

	// ✅ Activer publisher confirms
	if err := ch.Confirm(false); err != nil {
		_ = ch.Close()
		_ = conn.Close()
		return nil, fmt.Errorf("rabbitmq: confirm mode: %w", err)
	}

	client := &Client{
		conn:        conn,
		ch:          ch,
		url:         url,
		confirmMode: true,
		confirmCh:   ch.NotifyPublish(make(chan amqp.Confirmation, 100)),
	}

	logger.Info().Str("url", url).Msg("RabbitMQ connecte (confirms actifs)")
	return client, nil
}

func (c *Client) Close() {
	if c.ch != nil {
		_ = c.ch.Close()
	}
	if c.conn != nil {
		_ = c.conn.Close()
	}
}

// Publish envoie un message avec confirmation (garantie de livraison).
func (c *Client) Publish(ctx context.Context, routingKey string, payload any) error {
	if c == nil || c.ch == nil {
		return fmt.Errorf("rabbitmq non initialise")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Publier avec le mode confirm actif
	if err := c.ch.PublishWithContext(ctx,
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
	); err != nil {
		return fmt.Errorf("rabbitmq publish: %w", err)
	}

	// ✅ Attendre la confirmation
	select {
	case conf := <-c.confirmCh:
		if !conf.Ack {
			return fmt.Errorf("rabbitmq: message non confirme par le broker")
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("rabbitmq: timeout confirmation: %w", ctx.Err())
	}
}

// PublishAsync publie sans attendre la confirmation (pour les events non-critiques).
func (c *Client) PublishAsync(ctx context.Context, routingKey string, payload any) error {
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

// SubscribeOptions configure le consumer.
type SubscribeOptions struct {
	Queue        string
	RoutingKeys  []string
	Prefetch     int           // Nombre de messages non-ack en parallele
	MaxRetries   int           // Nombre max de retry avant DLQ (defaut 3)
	RetryBackoff time.Duration // Backoff initial (defaut 1s)
	Handler      Handler
}

// Subscribe declare une queue avec DLQ, retry et prefetch.
// L'architecture :
//   - Queue principale : queueName
//   - Dead Letter Queue : queueName.dlq (messages en echec apres MaxRetries)
//   - Retry : Re-publish dans la queue principale avec compteur d'essais (header)
func (c *Client) Subscribe(opts SubscribeOptions) error {
	if c == nil || c.ch == nil {
		return fmt.Errorf("rabbitmq non initialise")
	}

	// Defaults
	if opts.Prefetch <= 0 {
		opts.Prefetch = 10
	}
	if opts.MaxRetries <= 0 {
		opts.MaxRetries = 3
	}
	if opts.RetryBackoff <= 0 {
		opts.RetryBackoff = 1 * time.Second
	}

	dlqName := opts.Queue + ".dlq"

	// 1. Declarer la DLQ (sans DLQ elle-meme)
	if _, err := c.ch.QueueDeclare(
		dlqName,
		true,  // durable
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	); err != nil {
		return fmt.Errorf("rabbitmq: declare dlq: %w", err)
	}

	// 2. Declarer la queue principale avec argument DLQ
	args := amqp.Table{
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": dlqName,
	}
	if _, err := c.ch.QueueDeclare(
		opts.Queue,
		true,
		false,
		false,
		false,
		args,
	); err != nil {
		return fmt.Errorf("rabbitmq: declare queue: %w", err)
	}

	// 3. Bind les routing keys
	for _, rk := range opts.RoutingKeys {
		if err := c.ch.QueueBind(opts.Queue, rk, events.ExchangeName, false, nil); err != nil {
			return fmt.Errorf("rabbitmq: bind %s: %w", rk, err)
		}
	}

	// 4. ✅ Prefetch configurable
	if err := c.ch.Qos(opts.Prefetch, 0, false); err != nil {
		return fmt.Errorf("rabbitmq: qos: %w", err)
	}

	// 5. Consume
	deliveries, err := c.ch.Consume(
		opts.Queue,
		"",    // consumer tag
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		return fmt.Errorf("rabbitmq: consume: %w", err)
	}

	// 6. Goroutine de consommation
	go func() {
		for d := range deliveries {
			c.handleDelivery(d, opts)
		}
	}()

	logger.Info().
		Str("queue", opts.Queue).
		Strs("keys", opts.RoutingKeys).
		Int("prefetch", opts.Prefetch).
		Str("dlq", dlqName).
		Msg("Consumer RabbitMQ demarre")

	return nil
}

// handleDelivery traite un message avec retry et DLQ.
func (c *Client) handleDelivery(d amqp.Delivery, opts SubscribeOptions) {
	// Lire le compteur de retry depuis les headers
	retryCount := 0
	if v, ok := d.Headers["x-retry-count"]; ok {
		switch n := v.(type) {
		case int:
			retryCount = n
		case int32:
			retryCount = int(n)
		case int64:
			retryCount = int(n)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	err := opts.Handler(ctx, d.RoutingKey, d.Body)
	cancel()

	if err == nil {
		_ = d.Ack(false)
		return
	}

	// Erreur : retry avec backoff
	logger.Warn().
		Err(err).
		Str("queue", opts.Queue).
		Str("rk", d.RoutingKey).
		Int("retry", retryCount).
		Msg("Handler evenement echec")

	if retryCount >= opts.MaxRetries {
		// ✅ Max retries atteint → DLQ
		logger.Error().
			Str("queue", opts.Queue).
			Int("max_retries", opts.MaxRetries).
			Msg("Message envoye en DLQ")
		_ = d.Nack(false, false) // false = pas de requeue → DLQ
		return
	}

	// Backoff exponentiel : 1s, 2s, 4s
	backoff := opts.RetryBackoff * time.Duration(1<<uint(retryCount))
	if backoff > 30*time.Second {
		backoff = 30 * time.Second
	}
	time.Sleep(backoff)

	// Re-publier avec compteur increment
	headers := d.Headers
	if headers == nil {
		headers = amqp.Table{}
	}
	headers["x-retry-count"] = retryCount + 1

	if err := c.ch.PublishWithContext(
		context.Background(),
		events.ExchangeName,
		d.RoutingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  d.ContentType,
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now().UTC(),
			Body:         d.Body,
			Headers:      headers,
		},
	); err != nil {
		logger.Error().Err(err).Msg("Re-publish echoue, message perdu")
		_ = d.Nack(false, true) // dernier recours : requeue
		return
	}
	_ = d.Ack(false) // On a re-publie, on ACK l'original
}

// GetQueueInfo retourne les infos d'une queue (taille, consumers).
func (c *Client) GetQueueInfo(queueName string) (*QueueInfo, error) {
	if c == nil || c.ch == nil {
		return nil, fmt.Errorf("rabbitmq non initialise")
	}
	q, err := c.ch.QueueInspect(queueName)
	if err != nil {
		return nil, err
	}
	return &QueueInfo{
		Name:      q.Name,
		Messages:  q.Messages,
		Consumers: q.Consumers,
	}, nil
}

type QueueInfo struct {
	Name      string
	Messages  int
	Consumers int
}
