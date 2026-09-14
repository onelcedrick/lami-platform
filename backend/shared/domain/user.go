package domain

import (
	"time"
)

type Role string

const (
	RoleClient     Role = "client"
	RoleTechnician Role = "technician"
	RoleAdmin      Role = "admin"
	RoleSuperAdmin Role = "super_admin"
)

// Address enrichie pour GEO Madagascar (cahier + memo Toamasina)
type Address struct {
	Street     string  `json:"street" bson:"street"`
	City       string  `json:"city" bson:"city"`
	PostalCode string  `json:"postal_code" bson:"postal_code"`
	Region     string  `json:"region,omitempty" bson:"region,omitempty"`     // ex: Haute Matsiatra
	Province   string  `json:"province,omitempty" bson:"province,omitempty"` // ex: Toamasina
	Country    string  `json:"country" bson:"country"`                       // Madagascar
	CountryCode string `json:"country_code,omitempty" bson:"country_code,omitempty"` // MG
	Latitude   *float64 `json:"latitude,omitempty" bson:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty" bson:"longitude,omitempty"`
}

type User struct {
	ID           string                 `json:"id" bson:"_id,omitempty"`
	Email        string                 `json:"email" bson:"email"`
	PasswordHash string                 `json:"-" bson:"password_hash"`
	FirstName    string                 `json:"first_name" bson:"first_name"`
	LastName     string                 `json:"last_name" bson:"last_name"`
	Phone        string                 `json:"phone,omitempty" bson:"phone,omitempty"`
	Role         Role                   `json:"role" bson:"role"`
	IsActive     bool                   `json:"is_active" bson:"is_active"`
	IsVerified   bool                   `json:"is_verified" bson:"is_verified"`
	AvatarURL    string                 `json:"avatar_url,omitempty" bson:"avatar_url,omitempty"`
	Address      *Address               `json:"address,omitempty" bson:"address,omitempty"`
	Preferences  map[string]interface{} `json:"preferences,omitempty" bson:"preferences,omitempty"`
	Locale       string                 `json:"locale,omitempty" bson:"locale,omitempty"`     // fr-MG, fr, en, mg
	Currency     string                 `json:"currency,omitempty" bson:"currency,omitempty"` // MGA, EUR
	Cart         []UserCartItem         `json:"cart,omitempty" bson:"cart,omitempty"`
	Favorites    []UserFavoriteItem     `json:"favorites,omitempty" bson:"favorites,omitempty"`
	CreatedAt    time.Time              `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" bson:"updated_at"`
	LastLoginAt  *time.Time             `json:"last_login_at,omitempty" bson:"last_login_at,omitempty"`
}

type UserCartItem struct {
	ProductID string  `json:"product_id" bson:"product_id"`
	Name      string  `json:"name" bson:"name"`
	Price     float64 `json:"price" bson:"price"`
	Quantity  int     `json:"quantity" bson:"quantity"`
	Image     string  `json:"image,omitempty" bson:"image,omitempty"`
}

type UserFavoriteItem struct {
	ProductID string  `json:"product_id" bson:"product_id"`
	Name      string  `json:"name" bson:"name"`
	Slug      string  `json:"slug,omitempty" bson:"slug,omitempty"`
	Brand     string  `json:"brand,omitempty" bson:"brand,omitempty"`
	Price     float64 `json:"price" bson:"price"`
	Image     string  `json:"image,omitempty" bson:"image,omitempty"`
}

type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Phone     string `json:"phone,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type UpdateProfileRequest struct {
	FirstName   string                 `json:"first_name,omitempty"`
	LastName    string                 `json:"last_name,omitempty"`
	Phone       string                 `json:"phone,omitempty"`
	Address     *Address               `json:"address,omitempty"`
	Preferences map[string]interface{} `json:"preferences,omitempty"`
	Locale      string                 `json:"locale,omitempty"`
	Currency    string                 `json:"currency,omitempty"`
	AvatarURL   string                 `json:"avatar_url,omitempty"`
}

type AdminUpdateUserRequest struct {
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Role      Role   `json:"role,omitempty"`
	IsActive  *bool  `json:"is_active,omitempty"`
	IsVerified *bool `json:"is_verified,omitempty"`
	Address   *Address `json:"address,omitempty"`
}

type AuthResponse struct {
	User         *User  `json:"user"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// Regions Madagascar (GEO) - contexte L'AMI Toamasina
type GeoRegion struct {
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Province  string   `json:"province"`
	Cities    []string `json:"cities"`
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
}
