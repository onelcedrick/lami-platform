package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/lami-platform/shared/pkg/jwt"
	"github.com/lami-platform/shared/pkg/response"
)

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
		// SSE / EventSource: token en query (pas de header custom)
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

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)

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
