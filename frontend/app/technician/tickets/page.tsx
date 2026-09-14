"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");

  // Évite les erreurs d'hydratation : n'affiche l'UI qu'après le montage client
  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assigned, open, all] = await Promise.all([
        api.assignedTickets({ limit: 50 }),
        api.openTickets({ limit: 50 }),
        api.listTickets({ limit: 50 }).catch(() => ({ success: false })),
      ]);

      const extract = (res: any): Ticket[] => {
        if (!res || !res.success || !res.data) return [];
        const data = res.data;
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.items)) return data.items;
        return [];
      };

      const map = new Map<string, Ticket>();
      [...extract(all), ...extract(open), ...extract(assigned)].forEach((tk) => {
        if (tk && tk.id) map.set(tk.id, tk);
      });
      setTickets(Array.from(map.values()));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (status: string) => {
    if (!selected) return;
    setMessage("");
    const res = await api.updateTicketStatus(selected.id, { status });
    if (res.success && res.data) {
      setSelected(res.data as Ticket);
      setMessage("Statut mis à jour");
      load();
    } else {
      setMessage(res.error || "Erreur");
    }
  };

  const handleAssignSelf = async (ticketId: string) => {
    if (!user?.id) return;
    const res = await api.assignTicket(ticketId, user.id);
    if (res.success) {
      setMessage("Ticket assigné");
      load();
    }
  };

  // Attente du montage côté client (évite le hydration mismatch)
  if (!mounted) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mes tickets</h1>
        <p className="mt-1 text-slate-600">Tickets qui vous sont assignés</p>
        <p className="mt-6 text-sm text-slate-400">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Mes tickets</h1>
      <p className="mt-1 text-slate-600">Tickets qui vous sont assignés</p>

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
              <p className="p-5 text-sm text-slate-400">Aucun ticket assigné</p>
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
                <button
                  onClick={() => handleAssignSelf(selected.id)}
                  className="btn-primary text-xs"
                >
                  S&apos;assigner
                </button>
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
              Sélectionnez un ticket pour le traiter
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
