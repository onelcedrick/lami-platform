package session

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	redisclient "github.com/lami-platform/shared/pkg/redis"
)

const (
	// Prefixes des cles Redis
	sessionPrefix       = "session:"        // session:{userID}:{jti} = metadata JSON
	userSessionsPrefix  = "sessions:"       // sessions:{userID} = SET des JTI
	blacklistPrefix     = "blacklist:"      // blacklist:{jti} = "1"
	refreshPrefix       = "refresh:"        // refresh:{jti} = refresh_token

	// TTL
	SessionTTL       = 7 * 24 * time.Hour   // 7 jours (access token)
	RefreshTTL       = 30 * 24 * time.Hour  // 30 jours (refresh token)
	BlacklistTTL     = 8 * 24 * time.Hour   // 8 jours (marge sur access)
)

// Session represente une session active.
type Session struct {
	JTI        string    `json:"jti"`
	UserID     string    `json:"user_id"`
	Email      string    `json:"email"`
	Role       string    `json:"role"`
	UserAgent  string    `json:"user_agent,omitempty"`
	IP         string    `json:"ip,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// Manager gere les sessions via Redis.
type Manager struct {
	redis *redisclient.Client
}

// NewManager cree un gestionnaire de sessions.
func NewManager(redis *redisclient.Client) *Manager {
	return &Manager{redis: redis}
}

// ============================================================
// CREATION DE SESSION
// ============================================================

// Create enregistre une nouvelle session apres login.
func (m *Manager) Create(
	ctx context.Context,
	userID, email, role, userAgent, ip string,
) (*Session, error) {
	if m.redis == nil {
		return nil, fmt.Errorf("session: redis non initialise")
	}

	jti := uuid.New().String()
	now := time.Now().UTC()

	sess := &Session{
		JTI:       jti,
		UserID:    userID,
		Email:     email,
		Role:      role,
		UserAgent: userAgent,
		IP:        ip,
		CreatedAt: now,
		ExpiresAt: now.Add(SessionTTL),
	}

	// 1. Stocker la session
	sessionKey := sessionPrefix + userID + ":" + jti
	if err := m.redis.SetJSON(ctx, sessionKey, sess, SessionTTL); err != nil {
		return nil, fmt.Errorf("session: store: %w", err)
	}

	// 2. Ajouter le JTI au SET des sessions de l'utilisateur
	userKey := userSessionsPrefix + userID
	if err := m.redis.SAdd(ctx, userKey, jti); err != nil {
		return nil, fmt.Errorf("session: sadd: %w", err)
	}
	_ = m.redis.Expire(ctx, userKey, RefreshTTL)

	return sess, nil
}

// ============================================================
// VERIFICATION
// ============================================================

// IsBlacklisted verifie si un JTI est blackliste.
func (m *Manager) IsBlacklisted(ctx context.Context, jti string) (bool, error) {
	if m.redis == nil || jti == "" {
		return false, nil
	}
	return m.redis.Exists(ctx, blacklistPrefix+jti)
}

// GetSession recupere une session par JTI.
func (m *Manager) GetSession(ctx context.Context, userID, jti string) (*Session, error) {
	if m.redis == nil {
		return nil, fmt.Errorf("session: redis non initialise")
	}
	key := sessionPrefix + userID + ":" + jti
	var sess Session
	if err := m.redis.GetJSON(ctx, key, &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

// ============================================================
// REVOCATION
// ============================================================

// Revoke blackliste un token (access ou refresh).
func (m *Manager) Revoke(ctx context.Context, jti string, ttl time.Duration) error {
	if m.redis == nil {
		return nil
	}
	return m.redis.Set(ctx, blacklistPrefix+jti, "1", ttl)
}

// RevokeSession supprime une session specifique.
func (m *Manager) RevokeSession(ctx context.Context, userID, jti string) error {
	if m.redis == nil {
		return nil
	}
	// 1. Blacklister
	_ = m.Revoke(ctx, jti, BlacklistTTL)

	// 2. Supprimer la session
	_ = m.redis.Del(ctx, sessionPrefix+userID+":"+jti)

	// 3. Retirer du SET
	_ = m.redis.SRem(ctx, userSessionsPrefix+userID, jti)

	return nil
}

// RevokeAll revoque toutes les sessions d'un utilisateur.
func (m *Manager) RevokeAll(ctx context.Context, userID string) (int, error) {
	if m.redis == nil {
		return 0, nil
	}

	// 1. Recuperer tous les JTI
	jtis, err := m.redis.SMembers(ctx, userSessionsPrefix+userID)
	if err != nil {
		return 0, err
	}

	// 2. Blacklister chaque JTI + supprimer la session
	for _, jti := range jtis {
		_ = m.Revoke(ctx, jti, BlacklistTTL)
		_ = m.redis.Del(ctx, sessionPrefix+userID+":"+jti)
	}

	// 3. Supprimer le SET
	_ = m.redis.Del(ctx, userSessionsPrefix+userID)

	return len(jtis), nil
}

// ============================================================
// LISTE DES SESSIONS ACTIVES
// ============================================================

// ListActive retourne toutes les sessions actives d'un utilisateur.
func (m *Manager) ListActive(ctx context.Context, userID string) ([]*Session, error) {
	if m.redis == nil {
		return nil, nil
	}

	jtis, err := m.redis.SMembers(ctx, userSessionsPrefix+userID)
	if err != nil {
		return nil, err
	}

	sessions := make([]*Session, 0, len(jtis))
	for _, jti := range jtis {
		var sess Session
		key := sessionPrefix + userID + ":" + jti
		if err := m.redis.GetJSON(ctx, key, &sess); err == nil {
			sessions = append(sessions, &sess)
		} else {
			// Session expiree, nettoyer le SET
			_ = m.redis.SRem(ctx, userSessionsPrefix+userID, jti)
		}
	}

	return sessions, nil
}

// StoreRefresh stocke le refresh token (pour pouvoir le valider au refresh).
func (m *Manager) StoreRefresh(ctx context.Context, jti, refreshToken string) error {
	if m.redis == nil {
		return nil
	}
	return m.redis.Set(ctx, refreshPrefix+jti, refreshToken, RefreshTTL)
}

// GetRefresh recupere le refresh token stocke.
func (m *Manager) GetRefresh(ctx context.Context, jti string) (string, error) {
	if m.redis == nil {
		return "", fmt.Errorf("session: redis non initialise")
	}
	return m.redis.Get(ctx, refreshPrefix+jti)
}
