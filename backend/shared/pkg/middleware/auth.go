package middleware

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/jwt"
	redisclient "github.com/lami-platform/shared/pkg/redis"
	"github.com/lami-platform/shared/pkg/response"
)

// RedisClient global pour le middleware (injecte au demarrage)
var middlewareRedis *redisclient.Client

// SetRedisClient configure le client Redis pour le middleware.
func SetRedisClient(client *redisclient.Client) {
	middlewareRedis = client
}

func AuthRequired(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := ""
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				token = parts[1]
			}
		}
		// SSE / EventSource: token en query
		if token == "" {
			token = c.Query("access_token")
		}
		if token == "" {
			return response.Unauthorized(c, "Token d'authentification requis")
		}

		claims, err := jwt.ValidateToken(token, secret)
		if err != nil {
			return response.Unauthorized(c, "Token invalide ou expire")
		}

		// ✅ Verifier la blacklist Redis
		if middlewareRedis != nil && claims.ID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			blocked, _ := middlewareRedis.Exists(ctx, "blacklist:"+claims.ID)
			if blocked {
				return response.Unauthorized(c, "Token revoque")
			}
		}

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("jti", claims.ID)

		return c.Next()
	}
}

// AuthRequiredWithRedis est une variante qui prend le client Redis directement.
func AuthRequiredWithRedis(secret string, redis *redisclient.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := ""
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				token = parts[1]
			}
		}
		if token == "" {
			token = c.Query("access_token")
		}
		if token == "" {
			return response.Unauthorized(c, "Token d'authentification requis")
		}

		claims, err := jwt.ValidateToken(token, secret)
		if err != nil {
			return response.Unauthorized(c, "Token invalide ou expire")
		}

		// Verifier blacklist
		if redis != nil && claims.ID != "" {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			blocked, _ := redis.Exists(ctx, "blacklist:"+claims.ID)
			if blocked {
				return response.Unauthorized(c, "Token revoque")
			}
		}

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("jti", claims.ID)

		return c.Next()
	}
}

func RoleRequired(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok {
			return response.Forbidden(c, "Role non defini")
		}
		for _, r := range roles {
			if role == r {
				return c.Next()
			}
		}
		return response.Forbidden(c, "Acces refuse : permissions insuffisantes")
	}
}
