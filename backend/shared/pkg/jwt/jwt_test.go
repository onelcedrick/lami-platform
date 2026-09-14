package jwt

import (
	"testing"
	"time"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := "test-secret-key-lami"
	pair, err := GenerateTokenPair("user-123", "test@lami.mg", "client", secret, time.Hour)
	if err != nil {
		t.Fatalf("GenerateTokenPair: %v", err)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("tokens vides")
	}
	if pair.ExpiresIn != 3600 {
		t.Fatalf("expires_in attendu 3600, got %d", pair.ExpiresIn)
	}

	claims, err := ValidateToken(pair.AccessToken, secret)
	if err != nil {
		t.Fatalf("ValidateToken: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Fatalf("user_id: got %s", claims.UserID)
	}
	if claims.Email != "test@lami.mg" {
		t.Fatalf("email: got %s", claims.Email)
	}
	if claims.Role != "client" {
		t.Fatalf("role: got %s", claims.Role)
	}
}

func TestValidateTokenInvalid(t *testing.T) {
	_, err := ValidateToken("invalid.token.here", "secret")
	if err == nil {
		t.Fatal("attendu une erreur pour token invalide")
	}
}

func TestValidateTokenWrongSecret(t *testing.T) {
	pair, err := GenerateTokenPair("u1", "a@b.c", "admin", "secret-a", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	_, err = ValidateToken(pair.AccessToken, "secret-b")
	if err == nil {
		t.Fatal("attendu erreur secret different")
	}
}
