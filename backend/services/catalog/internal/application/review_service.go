package application

import (
	"context"
	"errors"
	"strings"

	"github.com/lami-platform/services/catalog/internal/domain"
)

type ReviewService struct {
	repo        domain.ReviewRepository
	productRepo domain.ProductRepository
}

func NewReviewService(repo domain.ReviewRepository, productRepo domain.ProductRepository) *ReviewService {
	return &ReviewService{repo: repo, productRepo: productRepo}
}

func (s *ReviewService) AddReview(ctx context.Context, review *domain.Review) error {
	if review.Rating < 1 || review.Rating > 5 {
		return errors.New("la note doit être comprise entre 1 et 5")
	}
	if strings.TrimSpace(review.Comment) == "" {
		return errors.New("le commentaire ne peut pas être vide")
	}

	if err := s.repo.Create(ctx, review); err != nil {
		return err
	}

	// Mettre à jour la note moyenne du produit pour l'affichage dans le catalogue
	avg, count, err := s.repo.GetAverageRating(ctx, review.ProductID)
	if err == nil {
		_ = s.productRepo.UpdateRating(ctx, review.ProductID, avg, count)
	}

	return nil
}

func (s *ReviewService) GetReviews(ctx context.Context, productID string) ([]domain.Review, error) {
	return s.repo.ListByProduct(ctx, productID)
}
