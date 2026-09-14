package application

import (
	"context"
	"errors"
	"time"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/user/internal/domain"
)

// Regions GEO Madagascar - L'AMI base a Toamasina (memo Master)
var MadagascarRegions = []shareddomain.GeoRegion{
	{
		Code: "HM", Name: "Haute Matsiatra", Province: "Toamasina",
		Cities: []string{"Toamasina", "Ambalavao", "Ambohimahasoa", "Ikalamavony", "Isandra"},
		Latitude: -21.4536, Longitude: 47.0858,
	},
	{
		Code: "AFI", Name: "Amoron'i Mania", Province: "Toamasina",
		Cities: []string{"Ambositra", "Fandriana", "Ambatofinandrahana"},
		Latitude: -20.5300, Longitude: 47.2500,
	},
	{
		Code: "VAT", Name: "Vatovavy", Province: "Toamasina",
		Cities: []string{"Mananjary", "Nosy Varika", "Ifanadiana"},
		Latitude: -21.2167, Longitude: 48.3333,
	},
	{
		Code: "FIT", Name: "Fitovinany", Province: "Toamasina",
		Cities: []string{"Manakara", "Vohipeno", "Ikongo"},
		Latitude: -22.1333, Longitude: 48.0167,
	},
	{
		Code: "ATS", Name: "Atsimo-Atsinanana", Province: "Toamasina",
		Cities: []string{"Farafangana", "Vangaindrano", "Midongy"},
		Latitude: -22.8167, Longitude: 47.8333,
	},
	{
		Code: "IHO", Name: "Ihorombe", Province: "Toamasina",
		Cities: []string{"Ihosy", "Ivohibe", "Ranohira"},
		Latitude: -22.4000, Longitude: 46.1167,
	},
	{
		Code: "AN", Name: "Analamanga", Province: "Antananarivo",
		Cities: []string{"Antananarivo", "Ambohidratrimo", "Anjozorobe", "Manjakandriana"},
		Latitude: -18.8792, Longitude: 47.5079,
	},
	{
		Code: "ATSIN", Name: "Atsinanana", Province: "Toamasina",
		Cities: []string{"Toamasina", "Brickaville", "Vatomandry"},
		Latitude: -18.1492, Longitude: 49.4023,
	},
	{
		Code: "DI", Name: "Diana", Province: "Antsiranana",
		Cities: []string{"Antsiranana", "Ambilobe", "Nosy Be"},
		Latitude: -12.2787, Longitude: 49.2917,
	},
	{
		Code: "MH", Name: "Menabe", Province: "Toliara",
		Cities: []string{"Morondava", "Mahabo", "Belo sur Tsiribihina"},
		Latitude: -20.2833, Longitude: 44.2833,
	},
}

type UserService struct {
	repo domain.UserRepository
}

func NewUserService(repo domain.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) GetProfile(ctx context.Context, userID string) (*shareddomain.User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, userID string, req shareddomain.UpdateProfileRequest) (*shareddomain.User, error) {
	user, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.Address != nil {
		if req.Address.Country == "" {
			req.Address.Country = "Madagascar"
		}
		if req.Address.CountryCode == "" {
			req.Address.CountryCode = "MG"
		}
		user.Address = req.Address
	}
	if req.Preferences != nil {
		user.Preferences = req.Preferences
	}
	if req.Locale != "" {
		user.Locale = req.Locale
	}
	if req.Currency != "" {
		user.Currency = req.Currency
	}
	if req.AvatarURL != "" {
		user.AvatarURL = req.AvatarURL
	}
	user.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) ListUsers(ctx context.Context, page, limit int, role, search string, activeOnly *bool) ([]shareddomain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	users, total, err := s.repo.List(ctx, page, limit, role, search, activeOnly)
	if err != nil {
		return nil, 0, err
	}
	for i := range users {
		users[i].PasswordHash = ""
	}
	return users, total, nil
}

func (s *UserService) GetUser(ctx context.Context, id string) (*shareddomain.User, error) {
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) AdminUpdateUser(ctx context.Context, id string, req shareddomain.AdminUpdateUserRequest) (*shareddomain.User, error) {
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.Role != "" {
		user.Role = req.Role
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	if req.IsVerified != nil {
		user.IsVerified = *req.IsVerified
	}
	if req.Address != nil {
		user.Address = req.Address
	}
	user.UpdatedAt = time.Now().UTC()

	if err := s.repo.Update(ctx, user); err != nil {
		return nil, err
	}
	user.PasswordHash = ""
	return user, nil
}

func (s *UserService) DeactivateUser(ctx context.Context, id string) error {
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if user.Role == shareddomain.RoleSuperAdmin {
		return errors.New("impossible de desactiver un super admin")
	}
	user.IsActive = false
	user.UpdatedAt = time.Now().UTC()
	return s.repo.Update(ctx, user)
}

func (s *UserService) Stats(ctx context.Context) (map[string]int64, error) {
	return s.repo.CountByRole(ctx)
}

func (s *UserService) ListRegions() []shareddomain.GeoRegion {
	return MadagascarRegions
}

func (s *UserService) GetCart(ctx context.Context, userID string) ([]shareddomain.UserCartItem, error) {
	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.Cart == nil {
		return []shareddomain.UserCartItem{}, nil
	}
	return u.Cart, nil
}

func (s *UserService) SaveCart(ctx context.Context, userID string, items []shareddomain.UserCartItem) ([]shareddomain.UserCartItem, error) {
	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []shareddomain.UserCartItem{}
	}
	u.Cart = items
	u.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, err
	}
	return u.Cart, nil
}

func (s *UserService) GetFavorites(ctx context.Context, userID string) ([]shareddomain.UserFavoriteItem, error) {
	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.Favorites == nil {
		return []shareddomain.UserFavoriteItem{}, nil
	}
	return u.Favorites, nil
}

func (s *UserService) SaveFavorites(ctx context.Context, userID string, items []shareddomain.UserFavoriteItem) ([]shareddomain.UserFavoriteItem, error) {
	u, err := s.repo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []shareddomain.UserFavoriteItem{}
	}
	u.Favorites = items
	u.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, err
	}
	return u.Favorites, nil
}

func (s *UserService) GetShopSettings(ctx context.Context) (*shareddomain.ShopSettings, error) {
	st, err := s.repo.GetSettings(ctx)
	if err != nil || st == nil {
		return shareddomain.DefaultShopSettings(), nil
	}
	return st, nil
}

func (s *UserService) UpdateShopSettings(ctx context.Context, st *shareddomain.ShopSettings) (*shareddomain.ShopSettings, error) {
	if st.ID == "" {
		st.ID = "shop"
	}
	if st.ShopName == "" {
		st.ShopName = "L'AMI"
	}
	if st.Currency == "" {
		st.Currency = "MGA"
	}
	if st.InvoicePrefix == "" {
		st.InvoicePrefix = "FAC"
	}
	st.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveSettings(ctx, st); err != nil {
		return nil, err
	}
	return st, nil
}
