package http

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/catalog/internal/application"
)

type CatalogHandler struct {
	service *application.CatalogService
}

func NewCatalogHandler(service *application.CatalogService) *CatalogHandler {
	return &CatalogHandler{service: service}
}

func (h *CatalogHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Catalog Service operationnel", fiber.Map{
		"service": "catalog",
		"status":  "healthy",
	})
}

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

func (h *CatalogHandler) Seed(c *fiber.Ctx) error {
	if err := h.service.SeedCategories(c.Context()); err != nil {
		return response.InternalError(c, err.Error())
	}
	if err := h.service.SeedSampleProducts(c.Context()); err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Donnees de demonstration chargees", nil)
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

	// Resolve category names embedded in attributes or CategoryID if looks like name
	for i := range body.Products {
		cid := body.Products[i].CategoryID
		if cid != "" && len(cid) < 40 {
			// peut etre un nom de categorie
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
