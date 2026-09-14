"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Ticket, TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import { TicketIcon } from "@/components/ui/icons";

export default function TechnicianDashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.assignedTickets({ limit: 20 });
        if (res.success && res.data) setTickets(res.data as Ticket[]);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const open = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const critical = tickets.filter((t) => t.priority === "critical" || t.priority === "high").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard technicien</h1>
      <p className="mt-1 text-slate-600">Vos tickets et interventions</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Tickets assignes</p>
            <TicketIcon size={20} className="text-primary-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "—" : tickets.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">En cours / ouverts</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? "—" : open}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Priorite haute</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {loading ? "—" : critical}
          </p>
        </div>
      </div>

      <section className="card mt-8">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Tickets assignes</h2>
          <Link href="/technician/tickets" className="text-sm text-primary-600 hover:underline">
            Voir tout
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="p-5 text-sm text-slate-400">Chargement...</p>
          ) : tickets.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">
              Aucun ticket assigne pour le moment
            </p>
          ) : (
            tickets.slice(0, 8).map((t) => (
              <Link
                key={t.id}
                href={`/technician/tickets?id=${t.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">
                    {t.title}
                  </p>
                  <p className="text-xs text-slate-500">{t.ticket_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={t.priority}
                    label={TICKET_PRIORITY_LABELS[t.priority]}
                  />
                  <StatusBadge
                    status={t.status}
                    label={TICKET_STATUS_LABELS[t.status]}
                  />
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
