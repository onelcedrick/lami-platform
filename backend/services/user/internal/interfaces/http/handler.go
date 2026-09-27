package http

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/shared/pkg/storage"
	"github.com/lami-platform/services/user/internal/application"
)

type UserHandler struct {
	service *application.UserService
	store   storage.ObjectStore
}

func NewUserHandler(service *application.UserService, store storage.ObjectStore) *UserHandler {
	return &UserHandler{service: service, store: store}
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

func (h *UserHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "User Service operationnel", fiber.Map{
		"service": "user",
		"status":  "healthy",
	})
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

func (h *UserHandler) GetProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	user, err := h.service.GetProfile(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Profil recupere", user)
}

func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var req shareddomain.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	user, err := h.service.UpdateProfile(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Profil mis a jour", user)
}

// ---------------------------------------------------------------------------
// Admin — Utilisateurs
// ---------------------------------------------------------------------------

func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	role := c.Query("role")
	search := c.Query("search")
	var activeOnly *bool
	if a := c.Query("active"); a == "true" {
		t := true
		activeOnly = &t
	} else if a == "false" {
		f := false
		activeOnly = &f
	}

	users, total, err := h.service.ListUsers(c.Context(), page, limit, role, search, activeOnly)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Utilisateurs recuperes", users, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *UserHandler) GetUser(c *fiber.Ctx) error {
	user, err := h.service.GetUser(c.Context(), c.Params("id"))
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur recupere", user)
}

func (h *UserHandler) AdminUpdateUser(c *fiber.Ctx) error {
	var req shareddomain.AdminUpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	user, err := h.service.AdminUpdateUser(c.Context(), c.Params("id"), req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur mis a jour", user)
}

func (h *UserHandler) DeactivateUser(c *fiber.Ctx) error {
	if err := h.service.DeactivateUser(c.Context(), c.Params("id")); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Utilisateur desactive", nil)
}

func (h *UserHandler) Stats(c *fiber.Ctx) error {
	stats, err := h.service.Stats(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statistiques utilisateurs", stats)
}

func (h *UserHandler) ListRegions(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Regions Madagascar", h.service.ListRegions())
}

// ---------------------------------------------------------------------------
// Panier
// ---------------------------------------------------------------------------

func (h *UserHandler) GetCart(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	items, err := h.service.GetCart(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Panier", items)
}

func (h *UserHandler) SaveCart(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var body struct {
		Items []shareddomain.UserCartItem `json:"items"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	items, err := h.service.SaveCart(c.Context(), userID, body.Items)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Panier enregistre", items)
}

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

func (h *UserHandler) GetFavorites(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	items, err := h.service.GetFavorites(c.Context(), userID)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Favoris", items)
}

func (h *UserHandler) SaveFavorites(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	var body struct {
		Items []shareddomain.UserFavoriteItem `json:"items"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	items, err := h.service.SaveFavorites(c.Context(), userID, body.Items)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Favoris enregistres", items)
}

// ---------------------------------------------------------------------------
// Paramètres boutique
// ---------------------------------------------------------------------------

func (h *UserHandler) GetShopSettings(c *fiber.Ctx) error {
	st, err := h.service.GetShopSettings(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Parametres boutique", st)
}

func (h *UserHandler) UpdateShopSettings(c *fiber.Ctx) error {
	var body shareddomain.ShopSettings
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide")
	}
	st, err := h.service.UpdateShopSettings(c.Context(), &body)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Parametres enregistres", st)
}

// ---------------------------------------------------------------------------
// Upload d'avatar utilisateur
// ---------------------------------------------------------------------------

var (
	allowedAvatarTypes = map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/webp": true,
	}
	allowedAvatarExts = map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".webp": true,
	}
	maxAvatarSize = int64(2 * 1024 * 1024) // 2 MB
)

// UploadAvatar : POST /api/v1/users/me/avatar
// Reçoit un fichier image, l'envoie dans MinIO, et met à jour user.avatar_url
func (h *UserHandler) UploadAvatar(c *fiber.Ctx) error {
	if h.store == nil {
		return response.InternalError(c, "Object store non configure")
	}

	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	// 1. Récupérer le fichier
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.ValidationError(c, "Aucun fichier fourni (champ 'file')")
	}
	if fileHeader.Size == 0 {
		return response.ValidationError(c, "Fichier vide")
	}
	if fileHeader.Size > maxAvatarSize {
		return response.ValidationError(c, "Fichier trop volumineux (max 2 MB)")
	}

	// 2. Vérifier le type MIME
	contentType := fileHeader.Header.Get("Content-Type")
	if !allowedAvatarTypes[contentType] {
		return response.ValidationError(c, "Type non autorise (jpg, png, webp)")
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedAvatarExts[ext] {
		return response.ValidationError(c, "Extension non autorisee")
	}

	// 3. Ouvrir le fichier
	f, err := fileHeader.Open()
	if err != nil {
		return response.InternalError(c, "Impossible de lire le fichier")
	}
	defer f.Close()

	// 4. Générer une clé unique : avatars/<userID>-<uuid>-<timestamp>.jpg
	key := fmt.Sprintf(
		"avatars/%s-%s-%d%s",
		userID,
		uuid.New().String()[:8],
		time.Now().Unix(),
		ext,
	)

	// 5. Uploader vers MinIO
	publicURL, err := h.store.Put(c.Context(), key, f, fileHeader.Size, contentType)
	if err != nil {
		return response.InternalError(c, "Upload echoue: "+err.Error())
	}

	// 6. Sauvegarder l'URL dans le profil utilisateur
	user, err := h.service.UpdateAvatar(c.Context(), userID, publicURL)
	if err != nil {
		return response.InternalError(c, "Impossible de mettre a jour le profil: "+err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Avatar uploade", fiber.Map{
		"avatar_url": user.AvatarURL,
		"url":        publicURL,
		"key":        key,
	})
}

// DeleteAvatar : DELETE /api/v1/users/me/avatar
// Supprime l'avatar (revient aux initiales)
func (h *UserHandler) DeleteAvatar(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	user, err := h.service.UpdateAvatar(c.Context(), userID, "")
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Avatar supprime", fiber.Map{
		"avatar_url": user.AvatarURL,
	})
}
