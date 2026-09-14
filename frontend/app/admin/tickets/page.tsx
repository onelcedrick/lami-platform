"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Ticket,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listTickets({
        limit: 50,
        status: statusFilter || undefined,
      });
      if (res.success && res.data) setTickets(res.data as Ticket[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleStatus = async (status: string) => {
    if (!selected) return;
    setMessage("");
    const res = await api.updateTicketStatus(selected.id, {
      status,
      note: note || undefined,
    });
    if (res.success && res.data) {
      setSelected(res.data as Ticket);
      setNote("");
      setMessage("Ticket mis a jour");
      load();
    } else {
      setMessage(res.error || "Erreur");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets support</h1>
          <p className="mt-1 text-slate-600">Vue globale de tous les tickets</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Priorite</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Chargement...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Aucun ticket
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      selected?.id === t.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 line-clamp-1">{t.title}</p>
                      <p className="text-xs text-slate-400">{t.ticket_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={t.priority}
                        label={TICKET_PRIORITY_LABELS[t.priority]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={t.status}
                        label={TICKET_STATUS_LABELS[t.status]}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-5 lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">{selected.ticket_number}</p>
                <h2 className="font-semibold text-slate-900">{selected.title}</h2>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {selected.description}
              </p>
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
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-400">
                  Note interne
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="Note visible uniquement par l'equipe..."
                />
              </div>
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
              {selected.messages && selected.messages.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Messages
                  </p>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {selected.messages.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <p className="text-xs text-slate-400">
                          {m.author_role} —{" "}
                          {new Date(m.created_at).toLocaleString("fr-FR")}
                        </p>
                        <p className="mt-0.5">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Selectionnez un ticket pour voir le detail
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
