package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/services/ticket/internal/domain"
)

// ---------------------------------------------------------------------------
// UserDirectory — accès à la liste des techniciens (via user-service)
// ---------------------------------------------------------------------------

type UserDirectory interface {
	ListTechnicians(ctx context.Context) ([]TechnicianInfo, error)
}

type TechnicianInfo struct {
	ID        string `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type TicketService struct {
	ticketRepo domain.TicketRepository
	users      UserDirectory // peut être nil → pas d'auto-assignation
}

func NewTicketService(ticketRepo domain.TicketRepository, users UserDirectory) *TicketService {
	return &TicketService{ticketRepo: ticketRepo, users: users}
}

func generateTicketNumber() string {
	return fmt.Sprintf("TKT-%s-%s", time.Now().Format("20060102"), uuid.New().String()[:8])
}

// ---------------------------------------------------------------------------
// Création + auto-assignation
// ---------------------------------------------------------------------------

func (s *TicketService) CreateTicket(ctx context.Context, userID string, req shareddomain.CreateTicketRequest) (*shareddomain.Ticket, error) {
	priority := req.Priority
	if priority == "" {
		priority = shareddomain.TicketPriorityMedium
	}

	now := time.Now().UTC()
	ticket := &shareddomain.Ticket{
		ID:               uuid.New().String(),
		TicketNumber:     generateTicketNumber(),
		UserID:           userID,
		Title:            req.Title,
		Description:      req.Description,
		Category:         req.Category,
		Status:           shareddomain.TicketStatusOpen,
		Priority:         priority,
		Attachments:      req.Attachments,
		RelatedOrderID:   req.RelatedOrderID,
		RelatedProductID: req.RelatedProductID,
		Messages:         []shareddomain.TicketMessage{},
		InternalNotes:    []shareddomain.TicketNote{},
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if ticket.Attachments == nil {
		ticket.Attachments = []string{}
	}

	// Auto-assignation au technicien le moins chargé (best-effort)
	if err := s.autoAssign(ctx, ticket); err != nil {
		// On ne bloque pas la création en cas d'échec de l'assignation.
		fmt.Printf("[ticket] auto-assign failed: %v\n", err)
	}

	if err := s.ticketRepo.Create(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

// autoAssign assigne le ticket au technicien actif avec le moins de tickets ouverts.
// Si aucun technicien n'est disponible, le ticket reste "open" non-assigné.
func (s *TicketService) autoAssign(ctx context.Context, ticket *shareddomain.Ticket) error {
	if s.users == nil {
		return errors.New("annuaire utilisateurs indisponible")
	}

	techs, err := s.users.ListTechnicians(ctx)
	if err != nil {
		return fmt.Errorf("liste techniciens: %w", err)
	}
	if len(techs) == 0 {
		return nil // pas de technicien → reste open
	}

	var bestTech *TechnicianInfo
	var bestCount int64 = -1

	for i := range techs {
		count, err := s.ticketRepo.CountOpenByAssignee(ctx, techs[i].ID)
		if err != nil {
			continue
		}
		if bestCount == -1 || count < bestCount {
			bestCount = count
			bestTech = &techs[i]
		}
	}

	if bestTech == nil {
		return errors.New("aucun technicien disponible")
	}

	now := time.Now().UTC()
	ticket.AssignedTo = bestTech.ID
	ticket.AssignedToName = fmt.Sprintf("%s %s", bestTech.FirstName, bestTech.LastName)
	ticket.AssignedAt = &now
	ticket.AutoAssigned = true
	ticket.Status = shareddomain.TicketStatusInProgress

	fmt.Printf("[ticket] auto-assigned %s to %s (%s) — %d open tickets\n",
		ticket.TicketNumber, bestTech.ID, ticket.AssignedToName, bestCount)

	return nil
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

func (s *TicketService) GetTicket(ctx context.Context, id string) (*shareddomain.Ticket, error) {
	return s.ticketRepo.FindByID(ctx, id)
}

func (s *TicketService) GetUserTickets(ctx context.Context, userID string, page, limit int) ([]shareddomain.Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.ticketRepo.FindByUserID(ctx, userID, page, limit)
}

func (s *TicketService) ListOpenTickets(ctx context.Context, page, limit int) ([]shareddomain.Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.ticketRepo.List(ctx, page, limit, "open", "", "")
}

func (s *TicketService) GetAssignedTickets(ctx context.Context, assigneeID string, page, limit int) ([]shareddomain.Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.ticketRepo.FindByAssignee(ctx, assigneeID, page, limit)
}

func (s *TicketService) ListTickets(ctx context.Context, page, limit int, status, priority, category string) ([]shareddomain.Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return s.ticketRepo.List(ctx, page, limit, status, priority, category)
}

// ---------------------------------------------------------------------------
// Mise à jour
// ---------------------------------------------------------------------------

func (s *TicketService) UpdateStatus(ctx context.Context, id string, req shareddomain.UpdateTicketStatusRequest, actorID, actorRole string) (*shareddomain.Ticket, error) {
	ticket, err := s.ticketRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	ticket.Status = req.Status
	if req.Priority != "" {
		ticket.Priority = req.Priority
	}
	ticket.UpdatedAt = time.Now().UTC()

	if req.Status == shareddomain.TicketStatusResolved || req.Status == shareddomain.TicketStatusClosed {
		now := time.Now().UTC()
		ticket.ResolvedAt = &now
	}

	if req.Note != "" {
		note := shareddomain.TicketNote{
			ID:        uuid.New().String(),
			AuthorID:  actorID,
			Content:   req.Note,
			CreatedAt: time.Now().UTC(),
		}
		ticket.InternalNotes = append(ticket.InternalNotes, note)
	}

	if err := s.ticketRepo.Update(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

func (s *TicketService) AssignTicket(ctx context.Context, id, technicianID string) (*shareddomain.Ticket, error) {
	ticket, err := s.ticketRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	ticket.AssignedTo = technicianID
	ticket.AssignedAt = &now
	ticket.AutoAssigned = false // assignation manuelle

	if ticket.Status == shareddomain.TicketStatusOpen {
		ticket.Status = shareddomain.TicketStatusInProgress
	}

	// Enrichir le nom du technicien si l'annuaire est disponible
	if s.users != nil {
		if techs, err := s.users.ListTechnicians(ctx); err == nil {
			for _, t := range techs {
				if t.ID == technicianID {
					ticket.AssignedToName = fmt.Sprintf("%s %s", t.FirstName, t.LastName)
					break
				}
			}
		}
	}

	ticket.UpdatedAt = now
	if err := s.ticketRepo.Update(ctx, ticket); err != nil {
		return nil, err
	}
	return ticket, nil
}

// ---------------------------------------------------------------------------
// Messages et notes
// ---------------------------------------------------------------------------

func (s *TicketService) AddMessage(ctx context.Context, ticketID, authorID, authorRole, authorName, content string, isInternal bool, attachments []shareddomain.Attachment) (*shareddomain.Ticket, error) {
	ticket, err := s.ticketRepo.FindByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}

	if content == "" && len(attachments) == 0 {
		return nil, errors.New("message vide")
	}

	if attachments == nil {
		attachments = []shareddomain.Attachment{}
	}

	msg := shareddomain.TicketMessage{
		ID:          uuid.New().String(),
		AuthorID:    authorID,
		AuthorRole:  authorRole,
		AuthorName:  authorName,
		Content:     content,
		Attachments: attachments,
		IsInternal:  isInternal,
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.ticketRepo.AddMessage(ctx, ticketID, msg); err != nil {
		return nil, err
	}

	ticket.Messages = append(ticket.Messages, msg)
	ticket.UpdatedAt = time.Now().UTC()

	// Si un technicien répond, passer le ticket en in_progress s'il est encore open
	if !isInternal && (authorRole == "technician" || authorRole == "admin" || authorRole == "super_admin") {
		if ticket.Status == shareddomain.TicketStatusOpen {
			ticket.Status = shareddomain.TicketStatusInProgress
			_ = s.ticketRepo.Update(ctx, ticket)
		}
	}
	return ticket, nil
}

func (s *TicketService) AddInternalNote(ctx context.Context, ticketID, authorID, content string) (*shareddomain.Ticket, error) {
	ticket, err := s.ticketRepo.FindByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}

	note := shareddomain.TicketNote{
		ID:        uuid.New().String(),
		AuthorID:  authorID,
		Content:   content,
		CreatedAt: time.Now().UTC(),
	}

	if err := s.ticketRepo.AddInternalNote(ctx, ticketID, note); err != nil {
		return nil, err
	}

	ticket.InternalNotes = append(ticket.InternalNotes, note)
	return ticket, nil
}

// ---------------------------------------------------------------------------
// Contrôle d'accès
// ---------------------------------------------------------------------------

func (s *TicketService) CanAccess(ticket *shareddomain.Ticket, userID, role string) bool {
	if role == "admin" || role == "super_admin" {
		return true
	}
	if role == "technician" && (ticket.AssignedTo == userID || ticket.AssignedTo == "") {
		return true
	}
	return ticket.UserID == userID
}

func (s *TicketService) EnsureAccess(ctx context.Context, ticketID, userID, role string) (*shareddomain.Ticket, error) {
	ticket, err := s.ticketRepo.FindByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}
	if !s.CanAccess(ticket, userID, role) {
		return nil, errors.New("acces refuse a ce ticket")
	}
	return ticket, nil
}
