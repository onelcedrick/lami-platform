package domain

import (
	"time"
)

type TicketStatus string

const (
	TicketStatusOpen       TicketStatus = "open"
	TicketStatusInProgress TicketStatus = "in_progress"
	TicketStatusWaiting    TicketStatus = "waiting"
	TicketStatusResolved   TicketStatus = "resolved"
	TicketStatusClosed     TicketStatus = "closed"
)

type TicketPriority string

const (
	TicketPriorityCritical TicketPriority = "critical"
	TicketPriorityHigh     TicketPriority = "high"
	TicketPriorityMedium   TicketPriority = "medium"
	TicketPriorityLow      TicketPriority = "low"
)

type Ticket struct {
	ID              string         `json:"id" bson:"_id,omitempty"`
	TicketNumber    string         `json:"ticket_number" bson:"ticket_number"`
	UserID          string         `json:"user_id" bson:"user_id"`
	AssignedTo      string         `json:"assigned_to,omitempty" bson:"assigned_to,omitempty"`
	Title           string         `json:"title" bson:"title"`
	Description     string         `json:"description" bson:"description"`
	Category        string         `json:"category" bson:"category"`
	Status          TicketStatus   `json:"status" bson:"status"`
	Priority        TicketPriority `json:"priority" bson:"priority"`
	Attachments     []string       `json:"attachments,omitempty" bson:"attachments,omitempty"`
	InternalNotes   []TicketNote   `json:"internal_notes,omitempty" bson:"internal_notes,omitempty"`
	Messages        []TicketMessage `json:"messages,omitempty" bson:"messages,omitempty"`
	RelatedOrderID  string         `json:"related_order_id,omitempty" bson:"related_order_id,omitempty"`
	RelatedProductID string        `json:"related_product_id,omitempty" bson:"related_product_id,omitempty"`
	ResolvedAt      *time.Time     `json:"resolved_at,omitempty" bson:"resolved_at,omitempty"`
	CreatedAt       time.Time      `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at" bson:"updated_at"`
}

type TicketNote struct {
	ID        string    `json:"id" bson:"id"`
	AuthorID  string    `json:"author_id" bson:"author_id"`
	Content   string    `json:"content" bson:"content"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

type Attachment struct {
	ID       string `json:"id" bson:"id"`
	Name     string `json:"name" bson:"name"`
	URL      string `json:"url" bson:"url"`
	MimeType string `json:"mime_type" bson:"mime_type"`
	Size     int64  `json:"size" bson:"size"`
}

type TicketMessage struct {
	ID          string       `json:"id" bson:"id"`
	AuthorID    string       `json:"author_id" bson:"author_id"`
	AuthorRole  string       `json:"author_role" bson:"author_role"`
	AuthorName  string       `json:"author_name,omitempty" bson:"author_name,omitempty"`
	Content     string       `json:"content" bson:"content"`
	Attachments []Attachment `json:"attachments,omitempty" bson:"attachments,omitempty"`
	IsInternal  bool         `json:"is_internal" bson:"is_internal"`
	CreatedAt   time.Time    `json:"created_at" bson:"created_at"`
}

type AddMessageRequest struct {
	Content     string       `json:"content"`
	IsInternal  bool         `json:"is_internal"`
	Attachments []Attachment `json:"attachments,omitempty"`
	AuthorName  string       `json:"author_name,omitempty"`
}

type CreateTicketRequest struct {
	Title            string         `json:"title" validate:"required"`
	Description      string         `json:"description" validate:"required"`
	Category         string         `json:"category" validate:"required"`
	Priority         TicketPriority `json:"priority"`
	Attachments      []string       `json:"attachments,omitempty"`
	RelatedOrderID   string         `json:"related_order_id,omitempty"`
	RelatedProductID string         `json:"related_product_id,omitempty"`
}

type UpdateTicketStatusRequest struct {
	Status   TicketStatus   `json:"status" validate:"required"`
	Priority TicketPriority `json:"priority,omitempty"`
	Note     string         `json:"note,omitempty"`
}
