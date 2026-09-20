"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Ticket,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  TicketIcon,
  ChevronRightIcon,
  CpuIcon,
} from "@/components/ui/icons";

export default function TechnicianDashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Le technicien n'a besoin que de : ses tickets assignés + les tickets ouverts non assignés
        const [assigned, open] = await Promise.all([
          api.assignedTickets({ limit: 50 }),
          api.openTickets({ limit: 50 }),
        ]);

        const extract = (res: any): Ticket[] => {
          if (!res || !res.success || !res.data) return [];
          const data = res.data;
          if (Array.isArray(data)) return data;
          if (Array.isArray(data.items)) return data.items;
          return [];
        };

        // Fusionner en évitant les doublons
        const map = new Map<string, Ticket>();
        [...extract(assigned), ...extract(open)].forEach((tk) => {
          if (tk && tk.id) map.set(tk.id, tk);
        });

        setTickets(Array.from(map.values()));
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const open = tickets.filter(
    (t) => t.status === "open" || t.status === "in_progress"
  ).length;

  const critical = tickets.filter(
    (t) => t.priority === "critical" || t.priority === "high"
  ).length;

  const kpis = [
    {
      label: "Tickets assignés",
      value: tickets.length,
      icon: TicketIcon,
      color:
        "bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300",
    },
    {
      label: "En cours / ouverts",
      value: open,
      icon: CpuIcon,
      color:
        "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    },
    {
      label: "Priorité haute",
      value: critical,
      icon: TicketIcon,
      color:
        "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    },
  ];

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard technicien
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Vos tickets et interventions
        </p>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {k.label}
                </p>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.color}`}
                >
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? "—" : k.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Liste tickets */}
      <section className="card mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            Tickets assignés
          </h2>
          <Link
            href="/technician/tickets"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 transition hover:gap-2 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Voir tout
            <ChevronRightIcon size={14} />
          </Link>
        </div>

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
                size={32}
                className="mx-auto text-slate-300 dark:text-slate-600"
              />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Aucun ticket assigné pour le moment
              </p>
            </div>
          ) : (
            tickets.slice(0, 8).map((t) => (
              <Link
                key={t.id}
                href={`/technician/tickets?id=${t.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.ticket_number}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
