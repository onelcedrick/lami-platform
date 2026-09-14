"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Order, Ticket, ORDER_STATUS_LABELS, TICKET_STATUS_LABELS } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatAriary } from "@/lib/currency";
import { CartIcon, TicketIcon, CpuIcon, UserIcon } from "@/components/ui/icons";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ordRes, tktRes, prodRes] = await Promise.all([
          api.listOrders({ limit: 5 }),
          api.listTickets({ limit: 5 }),
          api.listProducts({ limit: 1 }),
        ]);
        if (ordRes.success && ordRes.data) setOrders(ordRes.data as Order[]);
        if (tktRes.success && tktRes.data) setTickets(tktRes.data as Ticket[]);
        if (prodRes.meta?.total) setProductCount(prodRes.meta.total);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;

  const kpis = [
    { label: "Produits", value: productCount, href: "/admin/products", icon: CpuIcon },
    { label: "Commandes recentes", value: orders.length, href: "/admin/orders", icon: CartIcon },
    { label: "Tickets ouverts", value: openTickets, href: "/admin/tickets", icon: TicketIcon },
    { label: "En attente traitement", value: pendingOrders, href: "/admin/orders", icon: UserIcon },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard administrateur</h1>
      <p className="mt-1 text-slate-600">Vue d&apos;ensemble de la plateforme L&apos;AMI</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className="card p-5 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{k.label}</p>
                <Icon size={20} className="text-primary-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {loading ? "—" : k.value}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Dernieres commandes</h2>
            <Link href="/admin/orders" className="text-sm text-primary-600 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="p-5 text-sm text-slate-400">Chargement...</p>
            ) : orders.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Aucune commande</p>
            ) : (
              orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders?id=${o.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{o.order_number}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(o.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatAriary(o.total)}</span>
                    <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Derniers tickets</h2>
            <Link href="/admin/tickets" className="text-sm text-primary-600 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="p-5 text-sm text-slate-400">Chargement...</p>
            ) : tickets.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Aucun ticket</p>
            ) : (
              tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tickets?id=${t.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 line-clamp-1">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.ticket_number}</p>
                  </div>
                  <StatusBadge status={t.status} label={TICKET_STATUS_LABELS[t.status]} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
