"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
// confirmPaymentAdmin available for momo
import { Order, ORDER_STATUS_LABELS } from "@/lib/types";
import StatusBadge from "@/components/ui/StatusBadge";


const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

async function openInvoice(id: string) {
  const res = await api.getInvoice(id);
  if (!res.success || !res.data) {
    alert(res.error || "Facture indisponible (commande non payee ?)");
    return;
  }
  const inv = res.data as any;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${inv.invoice_number}</title>
  <style>body{font-family:sans-serif;padding:24px} table{width:100%;border-collapse:collapse}
  td,th{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>
  <h1>Facture ${inv.invoice_number}</h1>
  <p>Commande ${inv.order_number}</p>
  <table><tr><th>Article</th><th>Qte</th><th>Total</th></tr>
  ${(inv.items||[]).map((i:any)=>`<tr><td>${i.product_name||i.product_id}</td><td>${i.quantity}</td><td>${i.total_price}</td></tr>`).join("")}
  </table>
  <p><strong>Total: ${inv.total} Ar</strong></p>
  </body></html>`);
  w.document.close();
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listOrders({
        limit: 50,
        status: statusFilter || undefined,
      });
      if (res.success && res.data) setOrders(res.data as Order[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdating(true);
    setMessage("");
    try {
      const res = await api.updateOrderStatus(orderId, { status });
      if (res.success) {
        setMessage("Statut mis a jour");
        await load();
        if (selected?.id === orderId && res.data) {
          setSelected(res.data as Order);
        }
      } else {
        setMessage(res.error || "Erreur");
      }
    } catch {
      setMessage("Erreur reseau");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commandes</h1>
          <p className="mt-1 text-slate-600">Gestion de toutes les commandes</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
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
                <th className="px-4 py-3">Numero</th>
                <th className="px-4 py-3">Total</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Aucune commande
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className={`cursor-pointer hover:bg-slate-50 ${
                      selected?.id === o.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {o.order_number}
                    </td>
                    <td className="px-4 py-3">{formatAriary(o.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.created_at).toLocaleDateString("fr-FR")}
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
              <h2 className="font-semibold text-slate-900">{selected.order_number}</h2>
              <p className="text-sm text-slate-500">
                Client : {selected.user_id.slice(0, 8)}...
              </p>
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Articles</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {selected.items.map((item, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {item.product_name || item.product_id.slice(0, 8)} x{item.quantity}
                      </span>
                      <span>{item.total_price.toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>{selected.sub_total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>Livraison</span>
                  <span>{selected.shipping_cost.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatAriary(selected.total)}</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-400">
                  Changer le statut
                </label>
                <select
                  value={selected.status}
                  disabled={updating}
                  onChange={(e) => handleStatusChange(selected.id, e.target.value)}
                  className="input-field"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {selected.shipping_address && (
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Adresse</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {selected.shipping_address.street}
                    <br />
                    {selected.shipping_address.postal_code} {selected.shipping_address.city}
                    <br />
                    {selected.shipping_address.country}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Selectionnez une commande pour voir le detail
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
