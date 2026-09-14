package application

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/catalog/internal/domain"
)

type CatalogService struct {
	productRepo  domain.ProductRepository
	categoryRepo domain.CategoryRepository
	discountRepo domain.DiscountRepository
}

func NewCatalogService(productRepo domain.ProductRepository, categoryRepo domain.CategoryRepository, discountRepo domain.DiscountRepository) *CatalogService {
	return &CatalogService{
		productRepo:  productRepo,
		categoryRepo: categoryRepo,
		discountRepo: discountRepo,
	}
}

func slugify(s string) string {
	s = strings.ToLower(s)
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	s = reg.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

func (s *CatalogService) CreateProduct(ctx context.Context, req shareddomain.CreateProductRequest) (*shareddomain.Product, error) {
	now := time.Now().UTC()
	product := &shareddomain.Product{
		ID:               uuid.New().String(),
		Name:             req.Name,
		Slug:             slugify(req.Name) + "-" + uuid.New().String()[:8],
		Description:      req.Description,
		ShortDescription: req.ShortDescription,
		SKU:              req.SKU,
		CategoryID:       req.CategoryID,
		Brand:            req.Brand,
		Price:            req.Price,
		CompareAtPrice:   req.CompareAtPrice,
		Stock:            req.Stock,
		StockAlert:       req.StockAlert,
		// IsActive:         true,
		Images:           req.Images,
		Attributes:       req.Attributes,
		Tags:             req.Tags,
		UsageTags:        req.UsageTags,
		Compatibilities:  req.Compatibilities,
		Status:           shareddomain.ProductStatusActive,
		IsFeatured:       req.IsFeatured,
		Rating:           0,
		ReviewCount:      0,
		SalesCount:       0,
		ViewCount:        0,
		PopularityScore:  0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if product.Images == nil {
		product.Images = []string{}
	}
	if product.Attributes == nil {
		product.Attributes = map[string]interface{}{}
	}

	if err := s.productRepo.Create(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

func (s *CatalogService) GetProduct(ctx context.Context, id string) (*shareddomain.Product, error) {
	product, err := s.productRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// Tracking vues (fire-and-forget pour la perf)
	_ = s.productRepo.IncrementViews(ctx, id)
	product.ViewCount++
	product.PopularityScore = ComputePopularityScore(product)
	return product, nil
}

func (s *CatalogService) GetProductBySlug(ctx context.Context, slug string) (*shareddomain.Product, error) {
	return s.productRepo.FindBySlug(ctx, slug)
}

func (s *CatalogService) ListProducts(ctx context.Context, filter shareddomain.ProductFilter) ([]shareddomain.Product, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	if filter.SortBy == "popularity" || filter.SortBy == "popularity_score" {
		return s.listPopularPaged(ctx, filter)
	}
	return s.productRepo.List(ctx, filter)
}

// ComputePopularityScore - algorithme de popularité L'AMI
// score = ventes*50 + vues*2 + (note * avis)*8 + featured*100 + boost récence
func ComputePopularityScore(p *shareddomain.Product) float64 {
	if p == nil {
		return 0
	}
	score := float64(p.SalesCount)*50.0 + float64(p.ViewCount)*2.0
	score += p.Rating * float64(p.ReviewCount) * 8.0
	if p.IsFeatured {
		score += 100
	}
	// Boost récence : max +50 si créé il y a moins de 30 jours
	days := time.Since(p.CreatedAt).Hours() / 24
	if days < 0 {
		days = 0
	}
	if days <= 30 {
		score += 50 * (1 - days/30)
	}
	// Pénalité rupture de stock légère
	if p.Stock <= 0 {
		score *= 0.4
	}
	return score
}

func (s *CatalogService) ListPopular(ctx context.Context, limit int) ([]shareddomain.Product, error) {
	if limit < 1 {
		limit = 8
	}
	products, err := s.productRepo.ListByPopularity(ctx, limit)
	if err != nil {
		return nil, err
	}
	// Re-rank avec le score complet
	type ranked struct {
		p shareddomain.Product
		s float64
	}
	items := make([]ranked, 0, len(products))
	for i := range products {
		sc := ComputePopularityScore(&products[i])
		products[i].PopularityScore = sc
		items = append(items, ranked{p: products[i], s: sc})
	}
	// Sort desc
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[j].s > items[i].s {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
	out := make([]shareddomain.Product, 0, limit)
	for i, it := range items {
		if i >= limit {
			break
		}
		out = append(out, it.p)
	}
	return out, nil
}

func (s *CatalogService) listPopularPaged(ctx context.Context, filter shareddomain.ProductFilter) ([]shareddomain.Product, int64, error) {
	all, err := s.ListPopular(ctx, filter.Limit)
	if err != nil {
		return nil, 0, err
	}
	return all, int64(len(all)), nil
}

func (s *CatalogService) RecordSale(ctx context.Context, productID string, qty int) error {
	return s.productRepo.IncrementSales(ctx, productID, qty)
}

func (s *CatalogService) DecrementStock(ctx context.Context, productID string, qty int) error {
	return s.productRepo.DecrementStock(ctx, productID, qty)
}

func (s *CatalogService) Restock(ctx context.Context, productID string, qty int) error {
	return s.productRepo.IncrementStock(ctx, productID, qty)
}

// ApplyOrderCreated : reserve stock a la creation de commande
func (s *CatalogService) ApplyOrderCreated(ctx context.Context, items []struct {
	ProductID string
	Quantity  int
}) error {
	for _, it := range items {
		if err := s.DecrementStock(ctx, it.ProductID, it.Quantity); err != nil {
			return err
		}
	}
	return nil
}

// ApplyOrderPaid : enregistre les ventes (popularite)
func (s *CatalogService) ApplyOrderPaid(ctx context.Context, items []struct {
	ProductID string
	Quantity  int
}) error {
	for _, it := range items {
		_ = s.RecordSale(ctx, it.ProductID, it.Quantity)
	}
	return nil
}

// ApplyOrderCancelled : restock
func (s *CatalogService) ApplyOrderCancelled(ctx context.Context, items []struct {
	ProductID string
	Quantity  int
}) error {
	for _, it := range items {
		_ = s.Restock(ctx, it.ProductID, it.Quantity)
	}
	return nil
}


func (s *CatalogService) UpdateProduct(ctx context.Context, id string, req shareddomain.CreateProductRequest) (*shareddomain.Product, error) {
	product, err := s.productRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	product.Name = req.Name
	product.Description = req.Description
	product.ShortDescription = req.ShortDescription
	product.SKU = req.SKU
	product.CategoryID = req.CategoryID
	product.Brand = req.Brand
	product.Price = req.Price
	product.CompareAtPrice = req.CompareAtPrice
	product.Stock = req.Stock
	product.StockAlert = req.StockAlert
	product.Images = req.Images
	product.Attributes = req.Attributes
	product.Tags = req.Tags
	product.UsageTags = req.UsageTags
	product.Compatibilities = req.Compatibilities
	product.IsFeatured = req.IsFeatured
	product.UpdatedAt = time.Now().UTC()

	if err := s.productRepo.Update(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

func (s *CatalogService) DeleteProduct(ctx context.Context, id string) error {
	return s.productRepo.Delete(ctx, id)
}

func (s *CatalogService) CreateCategory(ctx context.Context, name, description string, parentID *string) (*shareddomain.Category, error) {
	now := time.Now().UTC()
	cat := &shareddomain.Category{
		ID:          uuid.New().String(),
		Name:        name,
		Slug:        slugify(name),
		Description: description,
		ParentID:    parentID,
		Order:       0,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.categoryRepo.Create(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *CatalogService) ListCategories(ctx context.Context) ([]shareddomain.Category, error) {
	return s.categoryRepo.ListTree(ctx)
}

func (s *CatalogService) GetCategory(ctx context.Context, id string) (*shareddomain.Category, error) {
	return s.categoryRepo.FindByID(ctx, id)
}

func (s *CatalogService) SeedCategories(ctx context.Context) error {
	categories := []struct {
		Name        string
		Description string
	}{
		{"CPU", "Processeurs"},
		{"GPU", "Cartes graphiques"},
		{"RAM", "Memoires vives"},
		{"Stockage", "SSD et HDD"},
		{"Carte mere", "Cartes meres"},
		{"Alimentation", "Blocs d'alimentation"},
		{"Boitier", "Boitiers PC"},
		{"Refroidissement", "Ventilateurs et watercooling"},
		{"Peripheriques", "Claviers, souris, ecrans"},
		{"PC Complets", "Configurations pre-assemblees"},
	}

	for _, c := range categories {
		existing, _ := s.categoryRepo.FindBySlug(ctx, slugify(c.Name))
		if existing != nil {
			continue
		}
		_, err := s.CreateCategory(ctx, c.Name, c.Description, nil)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *CatalogService) SeedSampleProducts(ctx context.Context) error {
	cats, err := s.categoryRepo.List(ctx)
	if err != nil || len(cats) == 0 {
		return errors.New("categories non disponibles")
	}

	catMap := make(map[string]string)
	for _, c := range cats {
		catMap[c.Name] = c.ID
	}

	samples := []shareddomain.CreateProductRequest{
		{
			Name: "AMD Ryzen 7 7800X3D", Description: "Processeur gaming haut de gamme avec cache 3D V-Cache",
			SKU: "CPU-AMD-7800X3D", CategoryID: catMap["CPU"], Brand: "AMD", Price: 449.99, Stock: 25, StockAlert: 5,
			UsageTags: []string{"gaming", "streaming"}, Attributes: map[string]interface{}{"cores": 8, "threads": 16, "socket": "AM5"},
			IsFeatured: true,
		},
		{
			Name: "NVIDIA GeForce RTX 4070 Ti", Description: "Carte graphique performante pour le gaming 1440p/4K",
			SKU: "GPU-NV-4070TI", CategoryID: catMap["GPU"], Brand: "NVIDIA", Price: 799.99, Stock: 12, StockAlert: 3,
			UsageTags: []string{"gaming", "creation"}, Attributes: map[string]interface{}{"vram": "12GB", "memory_type": "GDDR6X"},
			IsFeatured: true,
		},
		{
			Name: "Corsair Vengeance 32GB DDR5-6000", Description: "Kit memoire DDR5 haute performance",
			SKU: "RAM-COR-32GB-6000", CategoryID: catMap["RAM"], Brand: "Corsair", Price: 129.99, Stock: 40, StockAlert: 10,
			UsageTags: []string{"gaming", "bureautique"}, Attributes: map[string]interface{}{"capacity": "32GB", "speed": "6000MHz"},
		},
		{
			Name: "Samsung 990 PRO 2TB", Description: "SSD NVMe ultra-rapide",
			SKU: "SSD-SAM-990PRO-2T", CategoryID: catMap["Stockage"], Brand: "Samsung", Price: 189.99, Stock: 30, StockAlert: 8,
			UsageTags: []string{"gaming", "creation"}, Attributes: map[string]interface{}{"capacity": "2TB", "interface": "PCIe 4.0"},
		},
		{
			Name: "PC Gaming L'AMI Ultimate", Description: "Configuration complete optimisee pour le gaming 4K",
			SKU: "PC-LAMI-ULTIMATE", CategoryID: catMap["PC Complets"], Brand: "L'AMI", Price: 2499.99, Stock: 5, StockAlert: 2,
			UsageTags: []string{"gaming"}, IsFeatured: true,
			Attributes: map[string]interface{}{"cpu": "Ryzen 7 7800X3D", "gpu": "RTX 4070 Ti", "ram": "32GB", "storage": "2TB SSD"},
		},
	}

	// Stats de popularité initiales (demo réaliste)
	seedStats := map[string]struct {
		Sales, Views, Reviews int
		Rating                float64
	}{
		"CPU-AMD-7800X3D":     {Sales: 48, Views: 920, Reviews: 34, Rating: 4.8},
		"GPU-NV-4070TI":       {Sales: 36, Views: 1100, Reviews: 28, Rating: 4.7},
		"RAM-COR-32GB-6000":   {Sales: 62, Views: 540, Reviews: 19, Rating: 4.5},
		"SSD-SAM-990PRO-2T":   {Sales: 55, Views: 610, Reviews: 22, Rating: 4.9},
		"PC-LAMI-ULTIMATE":    {Sales: 14, Views: 780, Reviews: 11, Rating: 4.6},
	}

	for _, p := range samples {
		existing, _ := s.productRepo.FindBySlug(ctx, slugify(p.Name))
		if existing != nil {
			continue
		}
		product, err := s.CreateProduct(ctx, p)
		if err != nil {
			return err
		}
		if st, ok := seedStats[p.SKU]; ok {
			product.SalesCount = st.Sales
			product.ViewCount = st.Views
			product.ReviewCount = st.Reviews
			product.Rating = st.Rating
			product.PopularityScore = ComputePopularityScore(product)
			_ = s.productRepo.Update(ctx, product)
		}
	}
	return nil
}

// --- Promotions ---

func (s *CatalogService) CreateDiscount(ctx context.Context, req shareddomain.CreateDiscountRequest) (*shareddomain.Discount, error) {
	if s.discountRepo == nil {
		return nil, errors.New("service promotions indisponible")
	}
	dtype := shareddomain.DiscountType(req.Type)
	if dtype != shareddomain.DiscountTypePercentage && dtype != shareddomain.DiscountTypeFixedAmount {
		return nil, errors.New("type invalide: percentage ou fixed_amount")
	}
	target := shareddomain.DiscountTarget(req.Target)
	if target != shareddomain.DiscountTargetGlobal &&
		target != shareddomain.DiscountTargetCategory &&
		target != shareddomain.DiscountTargetProduct {
		return nil, errors.New("cible invalide: global, category ou product")
	}
	if target != shareddomain.DiscountTargetGlobal && req.TargetID == "" {
		return nil, errors.New("target_id requis pour categorie ou produit")
	}
	if dtype == shareddomain.DiscountTypePercentage && req.Value > 100 {
		return nil, errors.New("pourcentage max 100%")
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	now := time.Now().UTC()
	d := &shareddomain.Discount{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Type:        dtype,
		Value:       req.Value,
		Target:      target,
		TargetID:    req.TargetID,
		TargetLabel: req.TargetLabel,
		IsActive:    active,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.discountRepo.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *CatalogService) ListDiscounts(ctx context.Context) ([]shareddomain.Discount, error) {
	if s.discountRepo == nil {
		return []shareddomain.Discount{}, nil
	}
	return s.discountRepo.List(ctx)
}

func (s *CatalogService) ListActiveDiscounts(ctx context.Context) ([]shareddomain.Discount, error) {
	if s.discountRepo == nil {
		return []shareddomain.Discount{}, nil
	}
	return s.discountRepo.ListActive(ctx)
}

func (s *CatalogService) ToggleDiscount(ctx context.Context, id string) (*shareddomain.Discount, error) {
	d, err := s.discountRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	d.IsActive = !d.IsActive
	d.UpdatedAt = time.Now().UTC()
	if err := s.discountRepo.Update(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *CatalogService) DeleteDiscount(ctx context.Context, id string) error {
	return s.discountRepo.Delete(ctx, id)
}

// BestDiscountForProduct choisit la meilleure promo applicable (prix final le plus bas)
func (s *CatalogService) BestDiscountForProduct(ctx context.Context, product *shareddomain.Product) *shareddomain.Discount {
	if product == nil || s.discountRepo == nil {
		return nil
	}
	list, err := s.discountRepo.ListActive(ctx)
	if err != nil || len(list) == 0 {
		return nil
	}
	var best *shareddomain.Discount
	bestPrice := product.Price
	for i := range list {
		d := &list[i]
		applicable := false
		switch d.Target {
		case shareddomain.DiscountTargetGlobal:
			applicable = true
		case shareddomain.DiscountTargetCategory:
			applicable = d.TargetID == product.CategoryID
		case shareddomain.DiscountTargetProduct:
			applicable = d.TargetID == product.ID
		}
		if !applicable {
			continue
		}
		p := shareddomain.ApplyDiscount(product.Price, d)
		if p < bestPrice {
			bestPrice = p
			best = d
		}
	}
	return best
}

// BulkCreateResult resume d'import
type BulkCreateResult struct {
	Created int      `json:"created"`
	Failed  int      `json:"failed"`
	Errors  []string `json:"errors,omitempty"`
	IDs     []string `json:"ids,omitempty"`
}

func (s *CatalogService) BulkCreateProducts(ctx context.Context, reqs []shareddomain.CreateProductRequest) (*BulkCreateResult, error) {
	result := &BulkCreateResult{}
	if len(reqs) == 0 {
		return result, errors.New("aucun produit a importer")
	}
	if len(reqs) > 500 {
		return nil, errors.New("maximum 500 produits par import")
	}

	// Resolve category by name if needed later is done client-side
	for i, req := range reqs {
		if req.Name == "" || req.SKU == "" || req.CategoryID == "" || req.Price <= 0 {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("ligne %d: nom, SKU, categorie et prix obligatoires", i+1))
			continue
		}
		if req.Brand == "" {
			req.Brand = "Generic"
		}
		p, err := s.CreateProduct(ctx, req)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("ligne %d (%s): %s", i+1, req.SKU, err.Error()))
			continue
		}
		result.Created++
		result.IDs = append(result.IDs, p.ID)
	}
	return result, nil
}

// FindCategoryIDByName cherche une categorie par nom (insensible a la casse)
func (s *CatalogService) FindCategoryIDByName(ctx context.Context, name string) (string, error) {
	cats, err := s.categoryRepo.List(ctx)
	if err != nil {
		return "", err
	}
	lower := strings.ToLower(strings.TrimSpace(name))
	for _, c := range cats {
		if strings.ToLower(c.Name) == lower {
			return c.ID, nil
		}
	}
	return "", errors.New("categorie introuvable: " + name)
}
