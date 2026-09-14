package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	AppEnv          string
	ServiceName     string
	HTTPPort        string
	MongoURI        string
	MongoDBName     string
	RedisAddr       string
	JWTSecret       string
	JWTExpiration   time.Duration
	GatewayURL      string
	AuthServiceURL  string
	UserServiceURL  string
	CatalogURL      string
	OrderServiceURL string
	TicketServiceURL string
	NotifServiceURL string
	IAServiceURL    string
	AnalyticsURL    string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	FrontendURL        string
	RateLimit       int
	RabbitURL       string
}

func Load(serviceName string) *Config {
	return &Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		ServiceName:      serviceName,
		HTTPPort:         getEnv("HTTP_PORT", "8080"),
		MongoURI:         getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDBName:      getEnv("MONGO_DB", "lami_"+serviceName),
		RedisAddr:        getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:        getEnv("JWT_SECRET", "lami-super-secret-key-change-in-production-2026"),
		JWTExpiration:    time.Duration(getEnvAsInt("JWT_EXPIRATION_HOURS", 24)) * time.Hour,
		GatewayURL:       getEnv("GATEWAY_URL", "http://localhost:8000"),
		AuthServiceURL:   getEnv("AUTH_SERVICE_URL", "http://localhost:8081"),
		UserServiceURL:   getEnv("USER_SERVICE_URL", "http://localhost:8082"),
		CatalogURL:       getEnv("CATALOG_SERVICE_URL", "http://localhost:8083"),
		OrderServiceURL:  getEnv("ORDER_SERVICE_URL", "http://localhost:8084"),
		TicketServiceURL: getEnv("TICKET_SERVICE_URL", "http://localhost:8085"),
		NotifServiceURL:  getEnv("NOTIF_SERVICE_URL", "http://localhost:8086"),
		IAServiceURL:     getEnv("IA_SERVICE_URL", "http://localhost:8090"),
		AnalyticsURL:     getEnv("ANALYTICS_SERVICE_URL", "http://localhost:8087"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		RateLimit:        getEnvAsInt("RATE_LIMIT", 100),
		RabbitURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}
