"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Ticket,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import TicketChat from "@/components/tickets/TicketChat";
import { useAuthStore } from "@/lib/store";

export default function TechnicianTicketsPage() {
  const user = useAuthStore((s) => s.user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [assigned, open] = await Promise.all([
        api.assignedTickets({ limit: 50 }),
        api.openTickets({ limit: 50 }),
      ]);
      const a = assigned.success && assigned.data ? (assigned.data as Ticket[]) : [];
      const o = open.success && open.data
        ? ((open.data as any).items as Ticket[]) || (open.data as Ticket[])
        : [];
      // Merge: open non-assigned first, then assigned
      const map = new Map<string, Ticket>();
      [...o, ...a].forEach((t) => map.set(t.id, t));
      setTickets(Array.from(map.values()));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatus = async (status: string) => {
    if (!selected) return;
    setMessage("");
    const res = await api.updateTicketStatus(selected.id, { status });
    if (res.success && res.data) {
      setSelected(res.data as Ticket);
      setMessage("Statut mis a jour");
      load();
    } else {
      setMessage(res.error || "Erreur");
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    setMessage("");
    try {
      const res = await api.addTicketMessage(selected.id, {
        content: reply.trim(),
        is_internal: false,
      });
      if (res.success && res.data) {
        setSelected(res.data as Ticket);
        setReply("");
        setMessage("Message envoye");
        load();
      } else {
        setMessage(res.error || "Erreur");
      }
    } finally {
      setSending(false);
    }
  };

  const handleAssignSelf = async (ticketId: string) => {
    if (!user?.id) return;
    const res = await api.assignTicket(ticketId, user.id);
    if (res.success) {
      setMessage("Ticket assigne");
      load();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Mes tickets</h1>
      <p className="mt-1 text-slate-600">Tickets qui vous sont assignes</p>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="p-5 text-sm text-slate-400">Chargement...</p>
            ) : tickets.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Aucun ticket assigne</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${
                    selected?.id === t.id ? "bg-primary-50" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">
                    {t.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400">{t.ticket_number}</span>
                    <StatusBadge
                      status={t.priority}
                      label={TICKET_PRIORITY_LABELS[t.priority]}
                    />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card p-5 lg:col-span-3">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">{selected.ticket_number}</p>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selected.title}
                </h2>
              </div>
              <div className="flex gap-2">
                <StatusBadge
                  status={selected.status}
                  label={TICKET_STATUS_LABELS[selected.status]}
                />
                <StatusBadge
                  status={selected.priority}
                  label={TICKET_PRIORITY_LABELS[selected.priority]}
                />
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {selected.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {["in_progress", "waiting", "resolved", "closed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatus(s)}
                    className="btn-secondary text-xs"
                  >
                    {TICKET_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <TicketChat
                ticketId={selected.id}
                messages={(selected.messages || []) as any}
                allowInternal
                onMessagesUpdated={(msgs) =>
                  setSelected({ ...selected, messages: msgs as any })
                }
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Selectionnez un ticket pour le traiter
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
