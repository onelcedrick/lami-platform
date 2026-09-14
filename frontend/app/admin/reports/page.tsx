"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";

interface OrderStats {
  total_orders: number;
  pending_orders: number;
  paid_orders: number;
  cancelled_orders: number;
  revenue_paid: number;
  revenue_pending: number;
  average_order_value: number;
  currency: string;
  daily_revenue?: { date: string; orders: number; revenue: number }[];
  top_products?: {
    product_id: string;
    product_name: string;
    quantity: number;
    revenue: number;
  }[];
  by_payment_method?: Record<string, number>;
  by_status?: Record<string, number>;
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getOrderStats(days);
      if (res.success && res.data) {
        setStats(res.data as OrderStats);
      } else {
        setError(res.error || "Impossible de charger les stats");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const maxDaily =
    stats?.daily_revenue?.reduce((m, d) => Math.max(m, d.revenue), 0) || 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Rapports & CA
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Vue consolidee des commandes (source Order Service)
          </p>
        </div>
        <select
          className="input-field w-auto"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
          <option value={365}>1 an</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-400">Chargement...</p>
      ) : stats ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "CA encaissé",
                value: formatAriary(stats.revenue_paid),
                sub: `${stats.paid_orders} commandes payees`,
              },
              {
                label: "En attente",
                value: formatAriary(stats.revenue_pending),
                sub: `${stats.pending_orders} commandes`,
              },
              {
                label: "Panier moyen",
                value: formatAriary(stats.average_order_value || 0),
                sub: "commandes payees",
              },
              {
                label: "Total commandes",
                value: String(stats.total_orders),
                sub: `${stats.cancelled_orders} annulees`,
              },
            ].map((c) => (
              <div key={c.label} className="card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {c.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {c.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-semibold text-slate-900 dark:text-slate-50">
                CA journalier ({days} j)
              </h2>
              <div className="mt-4 space-y-2">
                {(stats.daily_revenue || []).length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Aucune vente payee sur la periode
                  </p>
                ) : (
                  stats.daily_revenue!.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-slate-500">
                        {d.date}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{
                            width: `${Math.max(4, (d.revenue / maxDaily) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right font-medium">
                        {formatAriary(d.revenue)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-slate-900 dark:text-slate-50">
                Top produits
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="pb-2">Produit</th>
                      <th className="pb-2 text-right">Qte</th>
                      <th className="pb-2 text-right">CA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(stats.top_products || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-6 text-center text-slate-400"
                        >
                          Pas encore de ventes
                        </td>
                      </tr>
                    ) : (
                      stats.top_products!.map((p) => (
                        <tr key={p.product_id}>
                          <td className="py-2 font-medium">
                            {p.product_name || p.product_id.slice(0, 8)}
                          </td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">
                            {formatAriary(p.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-semibold">Par statut</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {Object.entries(stats.by_status || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="font-semibold">Par paiement</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {Object.entries(stats.by_payment_method || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
