package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/jwt"
)

type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	FrontendURL  string
}

var oauthCfg OAuthConfig

func SetGlobalOAuthConfig(cfg OAuthConfig) {
	oauthCfg = cfg
}

func (s *AuthService) GoogleAuthURL(state string) (string, error) {
	if oauthCfg.ClientID == "" {
		return "", errors.New("OAuth Google non configure (GOOGLE_CLIENT_ID manquant)")
	}
	params := url.Values{
		"client_id":     {oauthCfg.ClientID},
		"redirect_uri":  {oauthCfg.RedirectURI},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"access_type":   {"online"},
		"prompt":        {"select_account"},
	}
	if state != "" {
		params.Set("state", state)
	}
	return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode(), nil
}

func (s *AuthService) HandleGoogleCallback(ctx context.Context, code string) (*shareddomain.AuthResponse, error) {
	if oauthCfg.ClientID == "" || oauthCfg.ClientSecret == "" {
		return nil, errors.New("OAuth Google non configure")
	}
	if code == "" {
		return nil, errors.New("code d'autorisation manquant")
	}

	token, err := exchangeGoogleCode(code)
	if err != nil {
		return nil, fmt.Errorf("echange code Google: %w", err)
	}

	info, err := fetchGoogleUserInfo(token)
	if err != nil {
		return nil, fmt.Errorf("profil Google: %w", err)
	}
	if info.Email == "" {
		return nil, errors.New("email Google non disponible")
	}

	user, err := s.userRepo.FindByEmail(ctx, info.Email)
	if err != nil {
		// Creer le compte
		now := time.Now().UTC()
		// Mot de passe aleatoire (non utilisable en login password)
		randomPass := uuid.New().String() + uuid.New().String()
		hash, _ := bcrypt.GenerateFromPassword([]byte(randomPass), bcrypt.DefaultCost)

		firstName := info.GivenName
		lastName := info.FamilyName
		if firstName == "" {
			parts := strings.Fields(info.Name)
			if len(parts) > 0 {
				firstName = parts[0]
			}
			if len(parts) > 1 {
				lastName = strings.Join(parts[1:], " ")
			}
		}

		user = &shareddomain.User{
			ID:           uuid.New().String(),
			Email:        info.Email,
			PasswordHash: string(hash),
			FirstName:    firstName,
			LastName:     lastName,
			Role:         shareddomain.RoleClient,
			IsActive:     true,
			IsVerified:   info.VerifiedEmail,
			AvatarURL:    info.Picture,
			Locale:       "fr-MG",
			Currency:     "MGA",
			Preferences: map[string]interface{}{
				"auth_provider": "google",
				"google_id":     info.ID,
			},
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, err
		}
	} else {
		if !user.IsActive {
			return nil, errors.New("compte desactive")
		}
		// Mettre a jour avatar / verification
		changed := false
		if info.Picture != "" && user.AvatarURL != info.Picture {
			user.AvatarURL = info.Picture
			changed = true
		}
		if info.VerifiedEmail && !user.IsVerified {
			user.IsVerified = true
			changed = true
		}
		if changed {
			user.UpdatedAt = time.Now().UTC()
			_ = s.userRepo.Update(ctx, user)
		}
		_ = s.userRepo.UpdateLastLogin(ctx, user.ID)
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

func exchangeGoogleCode(code string) (string, error) {
	data := url.Values{
		"code":          {code},
		"client_id":     {oauthCfg.ClientID},
		"client_secret": {oauthCfg.ClientSecret},
		"redirect_uri":  {oauthCfg.RedirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("google token error: %s", string(body))
	}

	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	if result.AccessToken == "" {
		return "", errors.New("access_token Google vide")
	}
	return result.AccessToken, nil
}

func fetchGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequest(http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo error: %s", string(body))
	}

	var info GoogleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func FrontendRedirectURL(frontendURL, accessToken, refreshToken string, errMsg string) string {
	base := strings.TrimRight(frontendURL, "/")
	if errMsg != "" {
		return fmt.Sprintf("%s/login?oauth_error=%s", base, url.QueryEscape(errMsg))
	}
	return fmt.Sprintf(
		"%s/auth/callback?access_token=%s&refresh_token=%s",
		base,
		url.QueryEscape(accessToken),
		url.QueryEscape(refreshToken),
	)
}

func (s *AuthService) IsGoogleOAuthEnabled() bool {
	return oauthCfg.ClientID != "" && oauthCfg.ClientSecret != ""
}

func (s *AuthService) GetFrontendURL() string {
	if oauthCfg.FrontendURL != "" {
		return oauthCfg.FrontendURL
	}
	return "http://localhost:3000"
}
