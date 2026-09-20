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
import { TicketIcon } from "@/components/ui/icons";

export default function TechnicianTicketsPage() {
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");

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

  if (!mounted) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Mes tickets
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Tickets qui vous sont assignés
        </p>
        <p className="mt-6 text-sm text-slate-400 dark:text-slate-500">
          Chargement...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Mes tickets
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Tickets qui vous sont assignés
        </p>
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800 dark:bg-primary-500/15 dark:text-primary-200">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Liste */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <TicketIcon
                  size={28}
                  className="mx-auto text-slate-300 dark:text-slate-600"
                />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Aucun ticket assigné
                </p>
              </div>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`w-full px-4 py-3 text-left transition ${
                    selected?.id === t.id
                      ? "bg-primary-50 dark:bg-primary-500/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {t.ticket_number}
                    </span>
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

        {/* Détail */}
        <div className="card p-5 lg:col-span-3">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selected.ticket_number}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selected.title}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  status={selected.status}
                  label={TICKET_STATUS_LABELS[selected.status]}
                />
                <StatusBadge
                  status={selected.priority}
                  label={TICKET_PRIORITY_LABELS[selected.priority]}
                />
              </div>

              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {selected.description}
              </p>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
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
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <TicketIcon
                size={40}
                className="text-slate-200 dark:text-slate-700"
              />
              <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                Sélectionnez un ticket pour le traiter
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}