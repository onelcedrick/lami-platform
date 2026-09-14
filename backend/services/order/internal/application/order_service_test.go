package application

import (
	"context"
	"errors"
	"testing"

	shareddomain "github.com/lami-platform/shared/domain"
)

type mockOrderRepo struct {
	orders map[string]*shareddomain.Order
}


type mockCatalog struct {
	products map[string]*shareddomain.Product
	disc     []shareddomain.Discount
}

func (m *mockCatalog) GetProduct(ctx context.Context, id string) (*shareddomain.Product, error) {
	p, ok := m.products[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return p, nil
}
func (m *mockCatalog) ListActiveDiscounts(ctx context.Context) ([]shareddomain.Discount, error) {
	return m.disc, nil
}

func testCatalog() *mockCatalog {
	return &mockCatalog{
		products: map[string]*shareddomain.Product{
			"prod-1": {ID: "prod-1", Name: "CPU Test", SKU: "CPU-1", Price: 100000, Stock: 10, Status: shareddomain.ProductStatusActive},
			"p1":     {ID: "p1", Name: "RAM Test", SKU: "RAM-1", Price: 50000, Stock: 5, Status: shareddomain.ProductStatusActive},
		},
	}
}

func newMockOrderRepo() *mockOrderRepo {
	return &mockOrderRepo{orders: make(map[string]*shareddomain.Order)}
}

func (m *mockOrderRepo) Create(ctx context.Context, order *shareddomain.Order) error {
	m.orders[order.ID] = order
	return nil
}
func (m *mockOrderRepo) FindByID(ctx context.Context, id string) (*shareddomain.Order, error) {
	o, ok := m.orders[id]
	if !ok {
		return nil, errNotFound("commande")
	}
	return o, nil
}
func (m *mockOrderRepo) FindByOrderNumber(ctx context.Context, n string) (*shareddomain.Order, error) {
	for _, o := range m.orders {
		if o.OrderNumber == n {
			return o, nil
		}
	}
	return nil, errNotFound("commande")
}
func (m *mockOrderRepo) FindByUserID(ctx context.Context, userID string, page, limit int) ([]shareddomain.Order, int64, error) {
	var list []shareddomain.Order
	for _, o := range m.orders {
		if o.UserID == userID {
			list = append(list, *o)
		}
	}
	return list, int64(len(list)), nil
}
func (m *mockOrderRepo) Update(ctx context.Context, order *shareddomain.Order) error {
	m.orders[order.ID] = order
	return nil
}
func (m *mockOrderRepo) UpdateStatus(ctx context.Context, id string, status shareddomain.OrderStatus, paymentStatus shareddomain.PaymentStatus) error {
	o, ok := m.orders[id]
	if !ok {
		return errNotFound("commande")
	}
	o.Status = status
	if paymentStatus != "" {
		o.PaymentStatus = paymentStatus
	}
	return nil
}
func (m *mockOrderRepo) GetStats(ctx context.Context, days int) (*shareddomain.OrderStats, error) {
	return &shareddomain.OrderStats{Currency: "MGA"}, nil
}
func (m *mockOrderRepo) List(ctx context.Context, page, limit int, status string) ([]shareddomain.Order, int64, error) {
	var list []shareddomain.Order
	for _, o := range m.orders {
		if status == "" || string(o.Status) == status {
			list = append(list, *o)
		}
	}
	return list, int64(len(list)), nil
}

type simpleError string

func (e simpleError) Error() string { return string(e) }
func errNotFound(entity string) error { return simpleError(entity + " introuvable") }

func TestCreateOrder(t *testing.T) {
	repo := newMockOrderRepo()
	svc := NewOrderService(repo, nil, testCatalog())

	order, err := svc.CreateOrder(context.Background(), "user-1", shareddomain.CreateOrderRequest{
		Items: []shareddomain.OrderItemRequest{
			{ProductID: "prod-1", Quantity: 2},
		},
		ShippingAddress: shareddomain.Address{
			Street: "Lot 1", City: "Toamasina", PostalCode: "301", Country: "Madagascar",
		},
		PaymentMethod: "card",
	})
	if err != nil {
		t.Fatalf("CreateOrder: %v", err)
	}
	if order.OrderNumber == "" {
		t.Fatal("order_number vide")
	}
	if order.Status != shareddomain.OrderStatusPending {
		t.Fatalf("status: %s", order.Status)
	}
	if order.UserID != "user-1" {
		t.Fatal("user_id incorrect")
	}
}

func TestCreateOrderEmptyItems(t *testing.T) {
	svc := NewOrderService(newMockOrderRepo(), nil, testCatalog())
	_, err := svc.CreateOrder(context.Background(), "u1", shareddomain.CreateOrderRequest{
		Items:         []shareddomain.OrderItemRequest{},
		PaymentMethod: "card",
	})
	if err == nil {
		t.Fatal("attendu erreur panier vide")
	}
}

func TestCancelOrder(t *testing.T) {
	repo := newMockOrderRepo()
	svc := NewOrderService(repo, nil, testCatalog())
	order, _ := svc.CreateOrder(context.Background(), "user-1", shareddomain.CreateOrderRequest{
		Items:         []shareddomain.OrderItemRequest{{ProductID: "p1", Quantity: 1}},
		PaymentMethod: "card",
		ShippingAddress: shareddomain.Address{City: "Toamasina", Country: "Madagascar"},
	})

	cancelled, err := svc.CancelOrder(context.Background(), order.ID, "user-1")
	if err != nil {
		t.Fatalf("CancelOrder: %v", err)
	}
	if cancelled.Status != shareddomain.OrderStatusCancelled {
		t.Fatalf("status: %s", cancelled.Status)
	}
}

func TestCancelOrderWrongUser(t *testing.T) {
	repo := newMockOrderRepo()
	svc := NewOrderService(repo, nil, testCatalog())
	order, _ := svc.CreateOrder(context.Background(), "user-1", shareddomain.CreateOrderRequest{
		Items:         []shareddomain.OrderItemRequest{{ProductID: "p1", Quantity: 1}},
		PaymentMethod: "card",
		ShippingAddress: shareddomain.Address{City: "Toamasina", Country: "MG"},
	})
	_, err := svc.CancelOrder(context.Background(), order.ID, "other-user")
	if err == nil {
		t.Fatal("attendu acces refuse")
	}
}

func TestGenerateInvoiceRequiresPaid(t *testing.T) {
	repo := newMockOrderRepo()
	svc := NewOrderService(repo, nil, testCatalog())
	order, err := svc.CreateOrder(context.Background(), "user-1", shareddomain.CreateOrderRequest{
		Items:         []shareddomain.OrderItemRequest{{ProductID: "prod-1", Quantity: 1}},
		PaymentMethod: "mvola",
		ShippingAddress: shareddomain.Address{City: "Toamasina", Country: "Madagascar"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.GenerateInvoice(context.Background(), order.ID)
	if err == nil {
		t.Fatal("attendu erreur facture sans paiement")
	}
}

func TestConfirmPaymentPublishesPaid(t *testing.T) {
	repo := newMockOrderRepo()
	svc := NewOrderService(repo, nil, testCatalog())
	order, _ := svc.CreateOrder(context.Background(), "user-1", shareddomain.CreateOrderRequest{
		Items:         []shareddomain.OrderItemRequest{{ProductID: "prod-1", Quantity: 1}},
		PaymentMethod: "mvola",
		ShippingAddress: shareddomain.Address{City: "Toamasina", Country: "Madagascar"},
	})
	paid, err := svc.ConfirmPayment(context.Background(), order.ID, "REF-TEST", "success")
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	if paid.PaymentStatus != shareddomain.PaymentStatusPaid {
		t.Fatalf("status %s", paid.PaymentStatus)
	}
	inv, err := svc.GenerateInvoice(context.Background(), paid.ID)
	if err != nil {
		t.Fatalf("invoice: %v", err)
	}
	if inv.InvoiceNumber == "" {
		t.Fatal("invoice_number vide")
	}
}
