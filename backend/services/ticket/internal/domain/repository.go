package domain

import (
	"context"

	shareddomain "github.com/lami-platform/shared/domain"
)

type TicketRepository interface {
	Create(ctx context.Context, ticket *shareddomain.Ticket) error
	FindByID(ctx context.Context, id string) (*shareddomain.Ticket, error)
	FindByTicketNumber(ctx context.Context, number string) (*shareddomain.Ticket, error)
	FindByUserID(ctx context.Context, userID string, page, limit int) ([]shareddomain.Ticket, int64, error)
	FindByAssignee(ctx context.Context, assigneeID string, page, limit int) ([]shareddomain.Ticket, int64, error)
	Update(ctx context.Context, ticket *shareddomain.Ticket) error
	List(ctx context.Context, page, limit int, status, priority, category string) ([]shareddomain.Ticket, int64, error)
	AddMessage(ctx context.Context, ticketID string, msg shareddomain.TicketMessage) error
	AddInternalNote(ctx context.Context, ticketID string, note shareddomain.TicketNote) error
}
