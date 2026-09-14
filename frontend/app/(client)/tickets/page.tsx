"use client";

import { useEffect, useState } from "react";
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

export default function ClientTicketsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
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
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.myTickets({ limit: 50 });
      if (res.success && res.data) setTickets(res.data as Ticket[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [isAuthenticated, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const res = await api.createTicket(form);
      if (res.success) {
        setMessage("Ticket cree avec succes");
        setShowForm(false);
        setForm({ title: "", description: "", category: "materiel", priority: "medium" });
        load();
      } else {
        setMessage(res.error || "Erreur");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.addTicketMessage(selected.id, { content: reply.trim() });
      if (res.success && res.data) {
        setSelected(res.data as Ticket);
        setReply("");
        setMessage("Message envoye");
        load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Support technique</h1>
          <p className="mt-1 text-slate-600">Vos tickets et demandes d&apos;assistance</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Annuler" : "Nouveau ticket"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800">
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Titre
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="Ex: Ecran bleu au demarrage"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[100px]"
              placeholder="Decrivez le probleme en detail..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Categorie
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                <option value="materiel">Materiel</option>
                <option value="logiciel">Logiciel</option>
                <option value="reseau">Reseau</option>
                <option value="commande">Commande</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Priorite
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
            {submitting ? "Envoi..." : "Creer le ticket"}
          </button>
        </form>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-2">
          {loading ? (
            <p className="p-5 text-sm text-slate-400">Chargement...</p>
          ) : tickets.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">Aucun ticket pour le moment</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((t) => (
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

              <TicketChat
                ticketId={selected.id}
                messages={(selected.messages || []) as any}
                onMessagesUpdated={(msgs) =>
                  setSelected({ ...selected, messages: msgs as any })
                }
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Selectionnez un ticket ou creez-en un nouveau
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
