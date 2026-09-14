package middleware

import (
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// SecureCORS — origines restreintes (CORS_ORIGINS=http://localhost:3000,https://aminfo.mg)
func SecureCORS() fiber.Handler {
	origins := os.Getenv("CORS_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000,http://127.0.0.1:3000"
	}
	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	})
}

type visitor struct {
	count    int
	windowAt time.Time
}

// RateLimit simple en memoire (par IP). limit = req / minute.
func RateLimit(limit int) fiber.Handler {
	if limit <= 0 {
		limit = 120
	}
	var mu sync.Mutex
	hits := map[string]*visitor{}
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		now := time.Now()
		mu.Lock()
		v, ok := hits[ip]
		if !ok || now.Sub(v.windowAt) > time.Minute {
			hits[ip] = &visitor{count: 1, windowAt: now}
			mu.Unlock()
			return c.Next()
		}
		v.count++
		if v.count > limit {
			mu.Unlock()
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error":   "Trop de requetes — reessayez dans une minute",
			})
		}
		mu.Unlock()
		return c.Next()
	}
}

// RequireStrongJWT refuse de demarrer en production avec secret demo
func JWTSecretOrFail() string {
	secret := os.Getenv("JWT_SECRET")
	env := os.Getenv("APP_ENV")
	demo := "lami-super-secret-key-change-in-production-2026"
	if secret == "" {
		secret = demo
	}
	if env == "production" && (secret == demo || len(secret) < 32) {
		panic("JWT_SECRET trop faible pour la production")
	}
	return secret
}

func SplitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
