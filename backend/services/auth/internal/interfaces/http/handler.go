package http

import (
	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/auth/internal/application"
)

type AuthHandler struct {
	authService *application.AuthService
}

func NewAuthHandler(authService *application.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req shareddomain.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return response.ValidationError(c, "Email, mot de passe, prenom et nom sont obligatoires")
	}

	if len(req.Password) < 8 {
		return response.ValidationError(c, "Le mot de passe doit contenir au moins 8 caracteres")
	}

	result, err := h.authService.Register(c.Context(), req)
	if err != nil {
		return response.Error(c, fiber.StatusConflict, err.Error())
	}

	return response.Success(c, fiber.StatusCreated, "Inscription reussie", result)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req shareddomain.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}

	if req.Email == "" || req.Password == "" {
		return response.ValidationError(c, "Email et mot de passe sont obligatoires")
	}

	result, err := h.authService.Login(c.Context(), req)
	if err != nil {
		return response.Unauthorized(c, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Connexion reussie", result)
}

func (h *AuthHandler) Profile(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Utilisateur non authentifie")
	}

	user, err := h.authService.GetProfile(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Profil recupere", user)
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&body); err != nil || body.RefreshToken == "" {
		return response.ValidationError(c, "Refresh token requis")
	}

	result, err := h.authService.RefreshToken(c.Context(), body.RefreshToken)
	if err != nil {
		return response.Unauthorized(c, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Token rafraichi", result)
}

func (h *AuthHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Auth Service operationnel", fiber.Map{
		"service": "auth",
		"status":  "healthy",
	})
}

func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	state := c.Query("state", "lami")
	authURL, err := h.authService.GoogleAuthURL(state)
	if err != nil {
		return response.Error(c, fiber.StatusServiceUnavailable, err.Error())
	}
	return c.Redirect(authURL, fiber.StatusTemporaryRedirect)
}

func (h *AuthHandler) GoogleCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	if errParam := c.Query("error"); errParam != "" {
		url := application.FrontendRedirectURL(h.authService.GetFrontendURL(), "", "", errParam)
		return c.Redirect(url, fiber.StatusTemporaryRedirect)
	}

	result, err := h.authService.HandleGoogleCallback(c.Context(), code)
	if err != nil {
		url := application.FrontendRedirectURL(h.authService.GetFrontendURL(), "", "", err.Error())
		return c.Redirect(url, fiber.StatusTemporaryRedirect)
	}

	url := application.FrontendRedirectURL(
		h.authService.GetFrontendURL(),
		result.AccessToken,
		result.RefreshToken,
		"",
	)
	return c.Redirect(url, fiber.StatusTemporaryRedirect)
}

func (h *AuthHandler) GoogleStatus(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Statut OAuth Google", fiber.Map{
		"enabled": h.authService.IsGoogleOAuthEnabled(),
	})
}
