package domain

import "time"

// ShopSettings — parametres boutique L'AMI (admin)
type ShopSettings struct {
	ID              string    `json:"id" bson:"_id,omitempty"`
	ShopName        string    `json:"shop_name" bson:"shop_name"`
	Tagline         string    `json:"tagline,omitempty" bson:"tagline,omitempty"`
	Phone           string    `json:"phone,omitempty" bson:"phone,omitempty"`
	Email           string    `json:"email,omitempty" bson:"email,omitempty"`
	Address         string    `json:"address,omitempty" bson:"address,omitempty"`
	City            string    `json:"city,omitempty" bson:"city,omitempty"`
	Region          string    `json:"region,omitempty" bson:"region,omitempty"`
	Country         string    `json:"country,omitempty" bson:"country,omitempty"`
	Currency        string    `json:"currency" bson:"currency"`
	MvolaNumber     string    `json:"mvola_number,omitempty" bson:"mvola_number,omitempty"`
	OrangeNumber    string    `json:"orange_number,omitempty" bson:"orange_number,omitempty"`
	AirtelNumber    string    `json:"airtel_number,omitempty" bson:"airtel_number,omitempty"`
	ShippingFee     float64   `json:"shipping_fee" bson:"shipping_fee"`
	FreeShippingMin float64   `json:"free_shipping_min" bson:"free_shipping_min"`
	InvoicePrefix   string    `json:"invoice_prefix" bson:"invoice_prefix"`
	UpdatedAt       time.Time `json:"updated_at" bson:"updated_at"`
}

func DefaultShopSettings() *ShopSettings {
	return &ShopSettings{
		ID:              "shop",
		ShopName:        "L'AMI",
		Tagline:         "Assistance informatique & composants PC",
		Phone:           "+261 00 00 000 00",
		Email:           "contact@lami.mg",
		Address:         "Fianarantsoa",
		City:            "Fianarantsoa",
		Region:          "Haute Matsiatra",
		Country:         "Madagascar",
		Currency:        "MGA",
		MvolaNumber:     "034 00 000 00",
		OrangeNumber:    "032 00 000 00",
		AirtelNumber:    "033 00 000 00",
		ShippingFee:     10000,
		FreeShippingMin: 500000,
		InvoicePrefix:   "FAC",
	}
}
