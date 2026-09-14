package application

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/jwt"
	"github.com/lami-platform/services/auth/internal/domain"
)

type AuthService struct {
	userRepo  domain.UserRepository
	jwtSecret string
	jwtExp    time.Duration
}

func NewAuthService(userRepo domain.UserRepository, jwtSecret string, jwtExp time.Duration) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		jwtExp:    jwtExp,
	}
}

func (s *AuthService) Register(ctx context.Context, req shareddomain.RegisterRequest) (*shareddomain.AuthResponse, error) {
	exists, err := s.userRepo.EmailExists(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("un compte existe deja avec cet email")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	user := &shareddomain.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Phone:        req.Phone,
		Role:         shareddomain.RoleClient,
		IsActive:     true,
		IsVerified:   false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, string(user.Role), s.jwtSecret, s.jwtExp)
	if err != nil {
		return nil, err
	}

	user.PasswordHash = ""
	return &shareddomain.AuthResponse{
		User:         user,
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
	}, nil
}

func (s *AuthService) Login(ctx context.Context, req shareddomain.LoginRequest) (*shareddomain.AuthResponse, error) {
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("email ou mot de passe incorrect")
	}

	if !user.IsActive {
		return nil, errors.New("compte desactive")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("email ou mot de passe incorrect")
	}

	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, string(user.Role), s.jwtSecret, s.jwtExp)
	if err != nil {
		return nil, err
	}

	user.PasswordHash = ""
	return &shareddomain.AuthResponse{
		User:         user,
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
	}, nil
}

func (s *AuthService) GetProfile(ctx context.Context, userID string) (*shareddomain.User, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*shareddomain.AuthResponse, error) {
	claims, err := jwt.ValidateToken(refreshToken, s.jwtSecret)
	if err != nil {
		return nil, errors.New("refresh token invalide")
	}

	user, err := s.userRepo.FindByID(ctx, claims.UserID)
	if err != nil {
		return nil, errors.New("utilisateur introuvable")
	}

	if !user.IsActive {
		return nil, errors.New("compte desactive")
	}

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, string(user.Role), s.jwtSecret, s.jwtExp)
	if err != nil {
		return nil, err
	}

	user.PasswordHash = ""
	return &shareddomain.AuthResponse{
		User:         user,
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
	}, nil
}
