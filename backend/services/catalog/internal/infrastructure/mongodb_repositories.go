package infrastructure

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/mongodb"
)

type MongoProductRepository struct {
	collection *mongo.Collection
}

func NewMongoProductRepository(client *mongodb.Client) *MongoProductRepository {
	return &MongoProductRepository{collection: client.Collection("products")}
}

func (r *MongoProductRepository) Create(ctx context.Context, product *shareddomain.Product) error {
	_, err := r.collection.InsertOne(ctx, product)
	return err
}

func (r *MongoProductRepository) FindByID(ctx context.Context, id string) (*shareddomain.Product, error) {
	var p shareddomain.Product
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&p)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("produit introuvable")
		}
		return nil, err
	}
	return &p, nil
}

func (r *MongoProductRepository) FindBySlug(ctx context.Context, slug string) (*shareddomain.Product, error) {
	var p shareddomain.Product
	err := r.collection.FindOne(ctx, bson.M{"slug": slug}).Decode(&p)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("produit introuvable")
		}
		return nil, err
	}
	return &p, nil
}

func (r *MongoProductRepository) Update(ctx context.Context, product *shareddomain.Product) error {
	product.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": product.ID}, product)
	return err
}

func (r *MongoProductRepository) Delete(ctx context.Context, id string) error {
	res, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return errors.New("produit introuvable")
	}
	return nil
}

func (r *MongoProductRepository) List(ctx context.Context, filter shareddomain.ProductFilter) ([]shareddomain.Product, int64, error) {
	query := bson.M{}

	if filter.CategoryID != "" {
		query["category_id"] = filter.CategoryID
	}
	if filter.Brand != "" {
		query["brand"] = filter.Brand
	}
	if filter.Status != "" {
		query["status"] = filter.Status
	} else {
		query["status"] = shareddomain.ProductStatusActive
	}
	if filter.IsFeatured != nil {
		query["is_featured"] = *filter.IsFeatured
	}
	if filter.MinPrice != nil || filter.MaxPrice != nil {
		priceQ := bson.M{}
		if filter.MinPrice != nil {
			priceQ["$gte"] = *filter.MinPrice
		}
		if filter.MaxPrice != nil {
			priceQ["$lte"] = *filter.MaxPrice
		}
		query["price"] = priceQ
	}
	if filter.Search != "" {
		// Recherche intelligente multi-champs (nom, marque, SKU, tags, usage...)
		query["$or"] = []bson.M{
			{"name": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"slug": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"short_description": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"description": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"brand": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"sku": bson.M{"$regex": filter.Search, "$options": "i"}},
			{"tags": bson.M{"$elemMatch": bson.M{"$regex": filter.Search, "$options": "i"}}},
			{"usage_tags": bson.M{"$elemMatch": bson.M{"$regex": filter.Search, "$options": "i"}}},
		}
	}
	if len(filter.UsageTags) > 0 {
		query["usage_tags"] = bson.M{"$in": filter.UsageTags}
	}

	total, err := r.collection.CountDocuments(ctx, query)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find()
	opts.SetSkip(int64((filter.Page - 1) * filter.Limit))
	opts.SetLimit(int64(filter.Limit))

	sortField := "created_at"
	sortOrder := -1
	if filter.SortBy != "" {
		sortField = filter.SortBy
	}
	if filter.SortOrder == "asc" {
		sortOrder = 1
	}
	// Alias popularité
	if sortField == "popularity" || sortField == "popularity_score" {
		opts.SetSort(bson.D{
			{Key: "popularity_score", Value: -1},
			{Key: "sales_count", Value: -1},
			{Key: "rating", Value: -1},
			{Key: "view_count", Value: -1},
		})
	} else {
		opts.SetSort(bson.D{{Key: sortField, Value: sortOrder}})
	}

	cursor, err := r.collection.Find(ctx, query, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var products []shareddomain.Product
	if err := cursor.All(ctx, &products); err != nil {
		return nil, 0, err
	}
	if products == nil {
		products = []shareddomain.Product{}
	}
	return products, total, nil
}

func (r *MongoProductRepository) FindByCategory(ctx context.Context, categoryID string, page, limit int) ([]shareddomain.Product, int64, error) {
	return r.List(ctx, shareddomain.ProductFilter{CategoryID: categoryID, Page: page, Limit: limit})
}


func (r *MongoProductRepository) IncrementViews(ctx context.Context, id string) error {
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$inc": bson.M{"view_count": 1},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	})
	return err
}

func (r *MongoProductRepository) IncrementSales(ctx context.Context, id string, qty int) error {
	if qty < 1 {
		qty = 1
	}
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$inc": bson.M{"sales_count": qty},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	})
	return err
}

// DecrementStock atomique — refuse si stock insuffisant
func (r *MongoProductRepository) DecrementStock(ctx context.Context, id string, qty int) error {
	if qty < 1 {
		qty = 1
	}
	res, err := r.collection.UpdateOne(ctx,
		bson.M{"_id": id, "stock": bson.M{"$gte": qty}},
		bson.M{
			"$inc": bson.M{"stock": -qty},
			"$set": bson.M{"updated_at": time.Now().UTC()},
		},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("stock insuffisant ou produit introuvable")
	}
	return nil
}

func (r *MongoProductRepository) IncrementStock(ctx context.Context, id string, qty int) error {
	if qty < 1 {
		qty = 1
	}
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{
		"$inc": bson.M{"stock": qty},
		"$set": bson.M{"updated_at": time.Now().UTC()},
	})
	return err
}

func (r *MongoProductRepository) ListByPopularity(ctx context.Context, limit int) ([]shareddomain.Product, error) {
	if limit < 1 {
		limit = 8
	}
	if limit > 50 {
		limit = 50
	}
	// Tri multi-critères côté Mongo (approximation), score final recalculé en service
	opts := options.Find().
		SetLimit(int64(limit * 3)). // marge pour re-rank
		SetSort(bson.D{
			{Key: "sales_count", Value: -1},
			{Key: "rating", Value: -1},
			{Key: "view_count", Value: -1},
			{Key: "is_featured", Value: -1},
		})
	cursor, err := r.collection.Find(ctx, bson.M{"status": shareddomain.ProductStatusActive}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var products []shareddomain.Product
	if err := cursor.All(ctx, &products); err != nil {
		return nil, err
	}
	if products == nil {
		products = []shareddomain.Product{}
	}
	return products, nil
}

type MongoCategoryRepository struct {
	collection *mongo.Collection
}

func NewMongoCategoryRepository(client *mongodb.Client) *MongoCategoryRepository {
	return &MongoCategoryRepository{collection: client.Collection("categories")}
}

func (r *MongoCategoryRepository) Create(ctx context.Context, category *shareddomain.Category) error {
	_, err := r.collection.InsertOne(ctx, category)
	return err
}

func (r *MongoCategoryRepository) FindByID(ctx context.Context, id string) (*shareddomain.Category, error) {
	var c shareddomain.Category
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&c)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("categorie introuvable")
		}
		return nil, err
	}
	return &c, nil
}

func (r *MongoCategoryRepository) FindBySlug(ctx context.Context, slug string) (*shareddomain.Category, error) {
	var c shareddomain.Category
	err := r.collection.FindOne(ctx, bson.M{"slug": slug}).Decode(&c)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *MongoCategoryRepository) Update(ctx context.Context, category *shareddomain.Category) error {
	category.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": category.ID}, category)
	return err
}

func (r *MongoCategoryRepository) Delete(ctx context.Context, id string) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *MongoCategoryRepository) List(ctx context.Context) ([]shareddomain.Category, error) {
	cursor, err := r.collection.Find(ctx, bson.M{"is_active": true}, options.Find().SetSort(bson.D{{Key: "order", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var cats []shareddomain.Category
	if err := cursor.All(ctx, &cats); err != nil {
		return nil, err
	}
	if cats == nil {
		cats = []shareddomain.Category{}
	}
	return cats, nil
}

func (r *MongoCategoryRepository) ListTree(ctx context.Context) ([]shareddomain.Category, error) {
	return r.List(ctx)
}


type MongoDiscountRepository struct {
	collection *mongo.Collection
}

func NewMongoDiscountRepository(client *mongodb.Client) *MongoDiscountRepository {
	return &MongoDiscountRepository{collection: client.Collection("discounts")}
}

func (r *MongoDiscountRepository) Create(ctx context.Context, d *shareddomain.Discount) error {
	_, err := r.collection.InsertOne(ctx, d)
	return err
}

func (r *MongoDiscountRepository) FindByID(ctx context.Context, id string) (*shareddomain.Discount, error) {
	var d shareddomain.Discount
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&d)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *MongoDiscountRepository) Update(ctx context.Context, d *shareddomain.Discount) error {
	d.UpdatedAt = time.Now().UTC()
	_, err := r.collection.ReplaceOne(ctx, bson.M{"_id": d.ID}, d)
	return err
}

func (r *MongoDiscountRepository) Delete(ctx context.Context, id string) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *MongoDiscountRepository) List(ctx context.Context) ([]shareddomain.Discount, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []shareddomain.Discount
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []shareddomain.Discount{}
	}
	return list, nil
}

func (r *MongoDiscountRepository) ListActive(ctx context.Context) ([]shareddomain.Discount, error) {
	now := time.Now().UTC()
	filter := bson.M{
		"is_active": true,
		"$and": []bson.M{
			{"$or": []bson.M{{"starts_at": nil}, {"starts_at": bson.M{"$lte": now}}}},
			{"$or": []bson.M{{"ends_at": nil}, {"ends_at": bson.M{"$gte": now}}}},
		},
	}
	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []shareddomain.Discount
	if err := cursor.All(ctx, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []shareddomain.Discount{}
	}
	return list, nil
}
