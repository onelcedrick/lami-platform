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
	"github.com/lami-platform/services/catalog/internal/application"
)

type CatalogHandler struct {
	service *application.CatalogService
	store   storage.ObjectStore
}

func NewCatalogHandler(service *application.CatalogService, store storage.ObjectStore) *CatalogHandler {
	return &CatalogHandler{service: service, store: store}
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

func (h *CatalogHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Catalog Service operationnel", fiber.Map{
		"service": "catalog",
		"status":  "healthy",
	})
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

func (h *CatalogHandler) ListProducts(c *fiber.Ctx) error {
	filter := shareddomain.ProductFilter{
		CategoryID: c.Query("category_id"),
		Brand:      c.Query("brand"),
		Search:     c.Query("search"),
		Status:     c.Query("status"),
		SortBy:     c.Query("sort_by", "created_at"),
		SortOrder:  c.Query("sort_order", "desc"),
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	filter.Page = page
	filter.Limit = limit

	if minP := c.Query("min_price"); minP != "" {
		if v, err := strconv.ParseFloat(minP, 64); err == nil {
			filter.MinPrice = &v
		}
	}
	if maxP := c.Query("max_price"); maxP != "" {
		if v, err := strconv.ParseFloat(maxP, 64); err == nil {
			filter.MaxPrice = &v
		}
	}
	if featured := c.Query("featured"); featured == "true" {
		t := true
		filter.IsFeatured = &t
	}
	// Filtre "en stock uniquement"
	if inStock := c.Query("in_stock"); inStock == "true" {
		t := true
		filter.InStock = &t
	}

	products, total, err := h.service.ListProducts(c.Context(), filter)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return response.SuccessWithMeta(c, fiber.StatusOK, "Produits recuperes", products, fiber.Map{
		"page":  filter.Page,
		"limit": filter.Limit,
		"total": total,
	})
}

func (h *CatalogHandler) GetProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	product, err := h.service.GetProduct(c.Context(), id)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Produit recupere", product)
}

func (h *CatalogHandler) GetProductBySlug(c *fiber.Ctx) error {
	slug := c.Params("slug")
	product, err := h.service.GetProductBySlug(c.Context(), slug)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Produit recupere", product)
}

func (h *CatalogHandler) CreateProduct(c *fiber.Ctx) error {
	var req shareddomain.CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	if req.Name == "" || req.SKU == "" || req.CategoryID == "" || req.Price <= 0 {
		return response.ValidationError(c, "Nom, SKU, categorie et prix sont obligatoires")
	}

	product, err := h.service.CreateProduct(c.Context(), req)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Produit cree", product)
}

func (h *CatalogHandler) UpdateProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	var req shareddomain.CreateProductRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}

	product, err := h.service.UpdateProduct(c.Context(), id, req)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Produit mis a jour", product)
}

func (h *CatalogHandler) DeleteProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.service.DeleteProduct(c.Context(), id); err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Produit supprime", nil)
}

func (h *CatalogHandler) ListPopular(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "8"))
	products, err := h.service.ListPopular(c.Context(), limit)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Produits populaires", products)
}

func (h *CatalogHandler) RecordSale(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		Quantity int `json:"quantity"`
	}
	_ = c.BodyParser(&body)
	if body.Quantity < 1 {
		body.Quantity = 1
	}
	if err := h.service.RecordSale(c.Context(), id, body.Quantity); err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Vente enregistree", nil)
}

func (h *CatalogHandler) BulkCreateProducts(c *fiber.Ctx) error {
	var body struct {
		Products []shareddomain.CreateProductRequest `json:"products"`
	}
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "JSON invalide: { products: [...] }")
	}
	if len(body.Products) == 0 {
		return response.ValidationError(c, "Aucun produit fourni")
	}

	for i := range body.Products {
		cid := body.Products[i].CategoryID
		if cid != "" && len(cid) < 40 {
			if id, err := h.service.FindCategoryIDByName(c.Context(), cid); err == nil {
				body.Products[i].CategoryID = id
			}
		}
	}

	result, err := h.service.BulkCreateProducts(c.Context(), body.Products)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Import termine", result)
}

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------

func (h *CatalogHandler) ListCategories(c *fiber.Ctx) error {
	cats, err := h.service.ListCategories(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Categories recuperees", cats)
}

func (h *CatalogHandler) CreateCategory(c *fiber.Ctx) error {
	var body struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		ParentID    *string `json:"parent_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.Name == "" {
		return response.ValidationError(c, "Nom de categorie requis")
	}

	cat, err := h.service.CreateCategory(c.Context(), body.Name, body.Description, body.ParentID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Categorie creee", cat)
}

// ---------------------------------------------------------------------------
// Promotions / Remises
// ---------------------------------------------------------------------------

func (h *CatalogHandler) CreateDiscount(c *fiber.Ctx) error {
	var req shareddomain.CreateDiscountRequest
	if err := c.BodyParser(&req); err != nil || req.Name == "" || req.Value <= 0 {
		return response.ValidationError(c, "Nom et valeur de promotion requis")
	}
	d, err := h.service.CreateDiscount(c.Context(), req)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Promotion creee", d)
}

func (h *CatalogHandler) ListDiscounts(c *fiber.Ctx) error {
	list, err := h.service.ListDiscounts(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Promotions", list)
}

func (h *CatalogHandler) ListActiveDiscounts(c *fiber.Ctx) error {
	list, err := h.service.ListActiveDiscounts(c.Context())
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Promotions actives", list)
}

func (h *CatalogHandler) ToggleDiscount(c *fiber.Ctx) error {
	id := c.Params("id")
	d, err := h.service.ToggleDiscount(c.Context(), id)
	if err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Promotion mise a jour", d)
}

func (h *CatalogHandler) DeleteDiscount(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.service.DeleteDiscount(c.Context(), id); err != nil {
		return response.NotFound(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Promotion supprimee", nil)
}

// ---------------------------------------------------------------------------
// Seed (dev)
// ---------------------------------------------------------------------------

func (h *CatalogHandler) Seed(c *fiber.Ctx) error {
	if err := h.service.SeedCategories(c.Context()); err != nil {
		return response.InternalError(c, err.Error())
	}
	if err := h.service.SeedSampleProducts(c.Context()); err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Donnees de demonstration chargees", nil)
}

// ---------------------------------------------------------------------------
// Upload d'images produit
// ---------------------------------------------------------------------------

var (
	allowedImageTypes = map[string]bool{
		"image/jpeg": true,
		"image/jpg":  true,
		"image/png":  true,
		"image/webp": true,
		"image/gif":  true,
	}
	allowedImageExts = map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
	}
	maxImageSize = int64(5 * 1024 * 1024) // 5 MB
)

func (h *CatalogHandler) UploadImage(c *fiber.Ctx) error {
	if h.store == nil {
		return response.InternalError(c, "Object store non configure")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.ValidationError(c, "Aucun fichier fourni (champ 'file')")
	}

	if fileHeader.Size == 0 {
		return response.ValidationError(c, "Fichier vide")
	}
	if fileHeader.Size > maxImageSize {
		return response.ValidationError(c, "Fichier trop volumineux (max 5 MB)")
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		return response.ValidationError(c, "Type non autorise (jpg, png, webp, gif)")
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedImageExts[ext] {
		return response.ValidationError(c, "Extension non autorisee")
	}

	f, err := fileHeader.Open()
	if err != nil {
		return response.InternalError(c, "Impossible de lire le fichier")
	}
	defer f.Close()

	key := fmt.Sprintf("products/%s-%d%s", uuid.New().String(), time.Now().Unix(), ext)

	publicURL, err := h.store.Put(c.Context(), key, f, fileHeader.Size, contentType)
	if err != nil {
		return response.InternalError(c, "Upload echoue: "+err.Error())
	}

	return response.Success(c, fiber.StatusOK, "Image uploadee", fiber.Map{
		"url":          publicURL,
		"key":          key,
		"size":         fileHeader.Size,
		"content_type": contentType,
	})
}

func (h *CatalogHandler) UploadMultipleImages(c *fiber.Ctx) error {
	if h.store == nil {
		return response.InternalError(c, "Object store non configure")
	}

	form, err := c.MultipartForm()
	if err != nil {
		return response.ValidationError(c, "Form multipart invalide")
	}
	files := form.File["files"]
	if len(files) == 0 {
		return response.ValidationError(c, "Aucun fichier fourni")
	}
	if len(files) > 8 {
		return response.ValidationError(c, "Maximum 8 fichiers par envoi")
	}

	type uploaded struct {
		URL  string `json:"url"`
		Key  string `json:"key"`
		Name string `json:"name"`
	}
	results := make([]uploaded, 0, len(files))
	errorsList := []string{}

	for _, fh := range files {
		if fh.Size == 0 || fh.Size > maxImageSize {
			errorsList = append(errorsList, fh.Filename+": taille invalide")
			continue
		}
		contentType := fh.Header.Get("Content-Type")
		if !allowedImageTypes[contentType] {
			errorsList = append(errorsList, fh.Filename+": type invalide")
			continue
		}
		ext := strings.ToLower(filepath.Ext(fh.Filename))
		if !allowedImageExts[ext] {
			errorsList = append(errorsList, fh.Filename+": extension invalide")
			continue
		}

		f, err := fh.Open()
		if err != nil {
			errorsList = append(errorsList, fh.Filename+": lecture impossible")
			continue
		}

		key := fmt.Sprintf("products/%s-%d%s", uuid.New().String(), time.Now().Unix(), ext)
		publicURL, err := h.store.Put(c.Context(), key, f, fh.Size, contentType)
		f.Close()
		if err != nil {
			errorsList = append(errorsList, fh.Filename+": upload echoue")
			continue
		}
		results = append(results, uploaded{URL: publicURL, Key: key, Name: fh.Filename})
	}

	return response.Success(c, fiber.StatusOK, "Upload termine", fiber.Map{
		"uploaded": results,
		"errors":   errorsList,
	})
}
