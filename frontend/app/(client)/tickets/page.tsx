"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import TicketChat from "@/components/tickets/TicketChat";
import { useAuthStore } from "@/lib/store";
import {
  Ticket,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import { TicketIcon } from "@/components/ui/icons";

export default function ClientTicketsPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "materiel",
    priority: "medium",
  });
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.myTickets({ limit: 50 });
      if (res.success && res.data) setTickets(res.data as Ticket[]);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [isAuthenticated, router, load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await api.createTicket(form);
      if (res.success) {
        setMessage({ type: "ok", text: "Ticket créé avec succès" });
        setShowForm(false);
        setForm({ title: "", description: "", category: "materiel", priority: "medium" });
        load();
      } else {
        setMessage({ type: "err", text: res.error || "Erreur" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Support technique
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Vos tickets et demandes d&apos;assistance
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          {showForm ? "Annuler" : "+ Nouveau ticket"}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg px-4 py-2 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <form onSubmit={handleCreate} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Titre
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="Ex: Écran bleu au démarrage"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[100px]"
              placeholder="Décrivez le problème en détail..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                <option value="materiel">Matériel</option>
                <option value="logiciel">Logiciel</option>
                <option value="reseau">Réseau</option>
                <option value="commande">Commande</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Priorité
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="input-field"
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Envoi..." : "Créer le ticket"}
          </button>
        </form>
      )}

      {/* Liste + détail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-2">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <TicketIcon
                size={36}
                className="mx-auto text-slate-200 dark:text-slate-700"
              />
              <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                Aucun ticket pour le moment
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map((t) => (
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
                      status={t.status}
                      label={TICKET_STATUS_LABELS[t.status]}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

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

              {/* ✅ Bandeau "Pris en charge par" */}
              {selected.assigned_to && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="text-emerald-800 dark:text-emerald-200">
                    Pris en charge par{" "}
                    <strong>
                      {selected.assigned_to_name || "un technicien"}
                    </strong>
                  </span>
                  {selected.auto_assigned && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Auto
                    </span>
                  )}
                </div>
              )}

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

              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {selected.description}
              </p>

              <TicketChat
                ticketId={selected.id}
                messages={(selected.messages || []) as any}
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
                Sélectionnez un ticket ou créez-en un nouveau
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
