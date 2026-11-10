package application

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/jwt"
	sessionpkg "github.com/lami-platform/shared/pkg/session"
	"github.com/lami-platform/services/auth/internal/domain"
)

type AuthService struct {
	userRepo  domain.UserRepository
	jwtSecret string
	jwtExp    time.Duration
	sessions  *sessionpkg.Manager
}

func NewAuthService(
	userRepo domain.UserRepository,
	jwtSecret string,
	jwtExp time.Duration,
	sessions *sessionpkg.Manager,
) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
		jwtExp:    jwtExp,
		sessions:  sessions,
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

	// ✅ NOUVEAU : Creer une session Redis
	if s.sessions != nil {
		sess, err := s.sessions.Create(
			ctx,
			user.ID,
			user.Email,
			string(user.Role),
			"", // user_agent (a recuperer du contexte si dispo)
			"", // ip
		)
		if err == nil && sess != nil {
			// Stocker le refresh token lie au JTI
			_ = s.sessions.StoreRefresh(ctx, sess.JTI, tokenPair.RefreshToken)
		}
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

	// ✅ Verifier que le refresh token n'est pas blackliste
	if s.sessions != nil && claims.ID != "" {
		blocked, _ := s.sessions.IsBlacklisted(ctx, claims.ID)
		if blocked {
			return nil, errors.New("refresh token revoque")
		}
	}

	// ✅ Revoquer l'ancien refresh token (rotation)
	if s.sessions != nil && claims.ID != "" {
		_ = s.sessions.Revoke(ctx, claims.ID, sessionpkg.RefreshTTL)
		_ = s.sessions.RevokeSession(ctx, user.ID, claims.ID)
	}

	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Email, string(user.Role), s.jwtSecret, s.jwtExp)
	if err != nil {
		return nil, err
	}

	// ✅ Creer une nouvelle session
	if s.sessions != nil {
		sess, err := s.sessions.Create(ctx, user.ID, user.Email, string(user.Role), "", "")
		if err == nil && sess != nil {
			_ = s.sessions.StoreRefresh(ctx, sess.JTI, tokenPair.RefreshToken)
		}
	}

	user.PasswordHash = ""
	return &shareddomain.AuthResponse{
		User:         user,
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
	}, nil
}

// ============================================================
// AJOUT : Logout + Sessions Redis
// ============================================================

// Logout revoque le refresh token (et l'access si fourni).
func (s *AuthService) Logout(ctx context.Context, userID, accessJTI, refreshJTI string) error {
	if s.sessions == nil {
		return nil
	}

	// 1. Blacklister l'access token (TTL court, il expire de toute facon)
	if accessJTI != "" {
		_ = s.sessions.Revoke(ctx, accessJTI, 24*time.Hour)
	}

	// 2. Blacklister + supprimer le refresh token
	if refreshJTI != "" {
		_ = s.sessions.RevokeSession(ctx, userID, refreshJTI)
	}

	return nil
}

// ListSessions retourne les sessions actives.
func (s *AuthService) ListSessions(ctx context.Context, userID string) ([]*sessionpkg.Session, error) {
	if s.sessions == nil {
		return nil, nil
	}
	return s.sessions.ListActive(ctx, userID)
}

// RevokeSession supprime une session specifique.
func (s *AuthService) RevokeSession(ctx context.Context, userID, jti string) error {
	if s.sessions == nil {
		return nil
	}
	return s.sessions.RevokeSession(ctx, userID, jti)
}

// RevokeAllSessions supprime toutes les sessions.
func (s *AuthService) RevokeAllSessions(ctx context.Context, userID string) (int, error) {
	if s.sessions == nil {
		return 0, nil
	}
	return s.sessions.RevokeAll(ctx, userID)
}

// IsBlacklisted verifie si un JTI est blackliste.
func (s *AuthService) IsBlacklisted(ctx context.Context, jti string) (bool, error) {
	if s.sessions == nil {
		return false, nil
	}
	return s.sessions.IsBlacklisted(ctx, jti)
}

// JWTSecret expose le secret (pour verifier les tokens dans les handlers).
func (s *AuthService) JWTSecret() string {
	return s.jwtSecret
}
