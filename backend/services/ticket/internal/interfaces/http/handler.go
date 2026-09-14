package http

import (
	"io"
	"time"
	"fmt"
	"encoding/json"
	"context"
	"bufio"
	"path/filepath"
	"strings"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	shareddomain "github.com/lami-platform/shared/domain"
	"github.com/lami-platform/shared/pkg/storage"
	"github.com/lami-platform/shared/pkg/response"
	"github.com/lami-platform/services/ticket/internal/application"
)

type TicketHandler struct {
	service *application.TicketService
	store   storage.ObjectStore
}

func NewTicketHandler(service *application.TicketService, store storage.ObjectStore) *TicketHandler {
	return &TicketHandler{service: service, store: store}
}

func (h *TicketHandler) Health(c *fiber.Ctx) error {
	return response.Success(c, fiber.StatusOK, "Ticket Service operationnel", fiber.Map{
		"service": "ticket",
		"status":  "healthy",
	})
}

func (h *TicketHandler) CreateTicket(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}

	var req shareddomain.CreateTicketRequest
	if err := c.BodyParser(&req); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	if req.Title == "" || req.Description == "" || req.Category == "" {
		return response.ValidationError(c, "Titre, description et categorie sont obligatoires")
	}

	ticket, err := h.service.CreateTicket(c.Context(), userID, req)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusCreated, "Ticket cree", ticket)
}

func (h *TicketHandler) GetTicket(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	role, _ := c.Locals("role").(string)
	id := c.Params("id")

	ticket, err := h.service.EnsureAccess(c.Context(), id, userID, role)
	if err != nil {
		return response.Forbidden(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Ticket recupere", ticket)
}

func (h *TicketHandler) GetMyTickets(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	tickets, total, err := h.service.GetUserTickets(c.Context(), userID, page, limit)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Tickets recuperes", tickets, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *TicketHandler) GetAssignedTickets(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok || userID == "" {
		return response.Unauthorized(c, "Authentification requise")
	}
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	tickets, total, err := h.service.GetAssignedTickets(c.Context(), userID, page, limit)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Tickets assignes recuperes", tickets, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *TicketHandler) ListTickets(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status")
	priority := c.Query("priority")
	category := c.Query("category")

	tickets, total, err := h.service.ListTickets(c.Context(), page, limit, status, priority, category)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.SuccessWithMeta(c, fiber.StatusOK, "Tickets recuperes", tickets, fiber.Map{
		"page": page, "limit": limit, "total": total,
	})
}

func (h *TicketHandler) UpdateStatus(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	role, _ := c.Locals("role").(string)
	id := c.Params("id")

	var req shareddomain.UpdateTicketStatusRequest
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return response.ValidationError(c, "Statut requis")
	}

	if _, err := h.service.EnsureAccess(c.Context(), id, userID, role); err != nil {
		return response.Forbidden(c, err.Error())
	}

	ticket, err := h.service.UpdateStatus(c.Context(), id, req, userID, role)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Statut mis a jour", ticket)
}

func (h *TicketHandler) AssignTicket(c *fiber.Ctx) error {
	id := c.Params("id")
	var body struct {
		TechnicianID string `json:"technician_id"`
	}
	if err := c.BodyParser(&body); err != nil || body.TechnicianID == "" {
		return response.ValidationError(c, "technician_id requis")
	}

	ticket, err := h.service.AssignTicket(c.Context(), id, body.TechnicianID)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Ticket assigne", ticket)
}

func (h *TicketHandler) AddMessage(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	role, _ := c.Locals("role").(string)
	id := c.Params("id")

	var body shareddomain.AddMessageRequest
	if err := c.BodyParser(&body); err != nil {
		return response.ValidationError(c, "Donnees invalides")
	}
	if body.Content == "" && len(body.Attachments) == 0 {
		return response.ValidationError(c, "Message ou piece jointe requis")
	}

	if _, err := h.service.EnsureAccess(c.Context(), id, userID, role); err != nil {
		return response.Forbidden(c, err.Error())
	}

	// Notes internes reservees aux techniciens/admins
	if body.IsInternal && role != "technician" && role != "admin" && role != "super_admin" {
		body.IsInternal = false
	}

	ticket, err := h.service.AddMessage(
		c.Context(), id, userID, role, body.AuthorName, body.Content, body.IsInternal, body.Attachments,
	)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Message ajoute", ticket)
}

func (h *TicketHandler) UploadFile(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return response.ValidationError(c, "Fichier requis (champ file)")
	}
	if file.Size > 10*1024*1024 {
		return response.ValidationError(c, "Fichier trop volumineux (max 10 Mo)")
	}

	mime := file.Header.Get("Content-Type")
	if mime == "" || mime == "application/octet-stream" {
		name := strings.ToLower(file.Filename)
		switch {
		case strings.HasSuffix(name, ".jpg"), strings.HasSuffix(name, ".jpeg"):
			mime = "image/jpeg"
		case strings.HasSuffix(name, ".png"):
			mime = "image/png"
		case strings.HasSuffix(name, ".pdf"):
			mime = "application/pdf"
		case strings.HasSuffix(name, ".gif"):
			mime = "image/gif"
		case strings.HasSuffix(name, ".webp"):
			mime = "image/webp"
		case strings.HasSuffix(name, ".txt"):
			mime = "text/plain"
		case strings.HasSuffix(name, ".zip"):
			mime = "application/zip"
		case strings.HasSuffix(name, ".doc"):
			mime = "application/msword"
		case strings.HasSuffix(name, ".docx"):
			mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		default:
			mime = "application/octet-stream"
		}
	}
	allowed := map[string]bool{
		"image/jpeg": true, "image/png": true, "image/gif": true, "image/webp": true,
		"application/pdf": true, "application/msword": true,
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
		"application/vnd.ms-excel": true,
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
		"text/plain": true, "application/zip": true, "application/x-zip-compressed": true,
	}
	if !allowed[mime] {
		return response.ValidationError(c, "Type de fichier non autorise: "+mime)
	}

	src, err := file.Open()
	if err != nil {
		return response.InternalError(c, "Lecture fichier impossible")
	}
	defer src.Close()

	id := uuid.New().String()
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".bin"
	}
	key := id + ext

	if h.store == nil {
		return response.InternalError(c, "Stockage fichiers non configure")
	}
	url, err := h.store.Put(c.Context(), key, src, file.Size, mime)
	if err != nil {
		return response.InternalError(c, "Echec upload: "+err.Error())
	}

	att := shareddomain.Attachment{
		ID:       id,
		Name:     file.Filename,
		URL:      url,
		MimeType: mime,
		Size:     file.Size,
	}
	return response.Success(c, fiber.StatusCreated, "Fichier uploade", att)
}

func (h *TicketHandler) ServeFile(c *fiber.Ctx) error {
	name := c.Params("filename")
	if name == "" || strings.Contains(name, "..") || strings.Contains(name, "/") {
		return response.ValidationError(c, "Nom de fichier invalide")
	}
	if h.store == nil {
		return response.NotFound(c, "Stockage indisponible")
	}
	rc, ct, err := h.store.Get(c.Context(), name)
	if err != nil {
		return response.NotFound(c, "Fichier introuvable")
	}
	defer rc.Close()
	c.Set("Content-Type", ct)
	c.Set("Cache-Control", "public, max-age=86400")
	_, err = io.Copy(c.Response().BodyWriter(), rc)
	return err
}

func (h *TicketHandler) StreamMessages(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	role, _ := c.Locals("role").(string)
	id := c.Params("id")

	if _, err := h.service.EnsureAccess(c.Context(), id, userID, role); err != nil {
		return response.Forbidden(c, err.Error())
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		lastCount := -1
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		// heartbeat + timeout ~5 min
		deadline := time.Now().Add(5 * time.Minute)
		for time.Now().Before(deadline) {
			<-ticker.C
			ticket, err := h.service.GetTicket(context.Background(), id)
			if err != nil {
				fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
				_ = w.Flush()
				return
			}
			count := len(ticket.Messages)
			if count != lastCount {
				lastCount = count
				payload, _ := json.Marshal(ticket.Messages)
				fmt.Fprintf(w, "event: messages\ndata: %s\n\n", payload)
				_ = w.Flush()
			} else {
				fmt.Fprintf(w, ": ping\n\n")
				_ = w.Flush()
			}
		}
		fmt.Fprintf(w, "event: done\ndata: {}\n\n")
		_ = w.Flush()
	})
	return nil
}

func (h *TicketHandler) ListOpenTickets(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	list, total, err := h.service.ListOpenTickets(c.Context(), page, limit)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return response.Success(c, fiber.StatusOK, "Tickets ouverts", fiber.Map{
		"items": list,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
