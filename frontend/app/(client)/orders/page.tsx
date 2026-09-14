"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Order } from "@/lib/types";
import { formatAriary } from "@/lib/currency";
import { logActivity } from "@/lib/analytics";
import MobileMoneyModal from "@/components/orders/MobileMoneyModal";

function paymentLabel(order: Order): { text: string; tone: string } {
  if (order.status === "cancelled") {
    return { text: "Annulee", tone: "bg-red-500/15 text-red-400" };
  }
  if (order.payment_status === "paid") {
    return { text: "Payee", tone: "bg-emerald-500/15 text-emerald-400" };
  }
  if (order.payment_status === "pending" || order.status === "pending" || order.status === "confirmed") {
    return {
      text: "En attente de paiement",
      tone: "bg-amber-500/15 text-amber-400",
    };
  }
  if (order.status === "shipped" || order.status === "delivered") {
    return { text: "Payee", tone: "bg-emerald-500/15 text-emerald-400" };
  }
  return {
    text: order.payment_status || order.status,
    tone: "bg-slate-500/15 text-slate-400",
  };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export default function ClientOrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [payTarget, setPayTarget] = useState<Order | null>(null);

  const load = async () => {
    try {
      const res = await api.myOrders({ limit: 50 });
      if (res.success && res.data) setOrders(res.data as Order[]);
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

  const handleCancel = async (id: string) => {
    setMessage("");
    const res = await api.cancelOrder(id);
    if (res.success) {
      setMessage("Commande annulee");
      await load();
    } else {
      setMessage(res.error || "Impossible d'annuler");
    }
  };

  const handlePay = async (method: string, phone: string) => {
    if (!payTarget) return;
    const res = await api.payOrder(payTarget.id, { method, phone });
    if (res.success) {
      void logActivity({
        action: "payment_initiated",
        category: "order",
        message: `Paiement ${method}`,
        resource: "order",
        resource_id: payTarget.id,
      });
      setMessage(
        method === "store"
          ? "Commande confirmee — paiement en boutique"
          : "Paiement Mobile Money initie — validez sur votre telephone"
      );
      setPayTarget(null);
      await load();
    } else {
      throw new Error(res.error || "Paiement refuse");
    }
  };

  const canPay = (o: Order) =>
    o.status !== "cancelled" && o.payment_status !== "paid";

  const canCancel = (o: Order) =>
    (o.status === "pending" || o.status === "confirmed") &&
    o.payment_status !== "paid";

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl sm:py-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Mes Commandes
      </h1>

      {message && (
        <div className="mt-4 rounded-xl bg-primary-500/10 px-4 py-2 text-sm text-primary-700 dark:text-primary-300">
          {message}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 py-12 text-center dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">
              Vous n&apos;avez pas encore de commande
            </p>
            <Link href="/catalog" className="btn-primary mt-4 inline-flex">
              Voir le catalogue
            </Link>
          </div>
        ) : (
          orders.map((o) => {
            const badge = paymentLabel(o);
            const shortId = (o.order_number || o.id).replace(/^ORD-?/i, "");
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        #{shortId.slice(0, 8)}
                      </span>{" "}
                      <span className="ml-1">{shortDate(o.created_at)}</span>
                    </p>
                    <p className="mt-2 text-xl font-semibold text-primary-600 dark:text-primary-400">
                      {formatAriary(o.total)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.tone}`}
                  >
                    {badge.text}
                  </span>
                </div>

                {canPay(o) && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayTarget(o)}
                      className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600"
                    >
                      Payer
                    </button>
                    {canCancel(o) && (
                      <button
                        type="button"
                        onClick={() => handleCancel(o.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-600"
                        aria-label="Annuler"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {payTarget && (
        <MobileMoneyModal
          orderNumber={(payTarget.order_number || payTarget.id).slice(0, 12)}
          amount={payTarget.total}
          onClose={() => setPayTarget(null)}
          onConfirm={handlePay}
        />
      )}
    </div>
  );
}
