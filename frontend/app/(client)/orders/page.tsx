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
import {
  XIcon,
  PackageIcon,
  ChevronRightIcon,
  CheckIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  mvola: "MVola",
  orange_money: "Orange Money",
  orange: "Orange Money",
  airtel_money: "Airtel Money",
  airtel: "Airtel Money",
  mobile_money: "Mobile Money",
  store: "Boutique",
};

function paymentLabel(order: Order): { text: string; tone: string } {
  if (order.status === "cancelled") {
    return {
      text: "Annulée",
      tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    };
  }
  if (order.payment_status === "paid") {
    return {
      text: "Payée",
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  if (
    order.payment_status === "pending" ||
    order.status === "pending" ||
    order.status === "confirmed"
  ) {
    return {
      text: "En attente de paiement",
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }
  if (order.status === "shipped" || order.status === "delivered") {
    return {
      text: "Payée",
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  return {
    text: order.payment_status || order.status,
    tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canPay(o: Order): boolean {
  if (o.payment_status === "paid") return false;
  if (
    o.status === "cancelled" ||
    o.status === "delivered" ||
    o.status === "refunded"
  )
    return false;
  return true;
}

function canCancel(o: Order): boolean {
  if (o.payment_status === "paid") return false;
  return o.status === "pending" || o.status === "confirmed";
}

function itemsCount(o: Order): number {
  return (o.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClientOrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.myOrders({ limit: 50 });
      if (res.success && res.data) setOrders(res.data as Order[]);
    } catch {
      /* silent */
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
    setMessage(null);
    const res = await api.cancelOrder(id);
    if (res.success) {
      setMessage({ type: "ok", text: "Commande annulée" });
      await load();
    } else {
      setMessage({ type: "err", text: res.error || "Impossible d'annuler" });
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
      setMessage({
        type: "ok",
        text:
          method === "store"
            ? "Commande confirmée — paiement en boutique"
            : "Paiement validé — commande confirmée. Vous pouvez récupérer votre commande en boutique.",
      });
      setPayTarget(null);
      await load();
    } else {
      throw new Error(res.error || "Paiement refusé");
    }
  };

  const handleDownloadInvoice = async (o: Order) => {
    setDownloadingId(o.id);
    setMessage(null);
    try {
      const shortId = (o.order_number || o.id).replace(/^ORD-?/i, "").slice(0, 8);
      await api.downloadInvoicePDF(o.id, `facture-${shortId}.pdf`);
    } catch {
      setMessage({
        type: "err",
        text: "Impossible de télécharger la facture. Réessayez plus tard.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <PackageIcon size={14} />
        Mes commandes
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        Historique de commandes
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Retrouvez et téléchargez toutes vos factures
      </p>

      {/* Message */}
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

      {/* Liste */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-6 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="card py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <PackageIcon
                size={28}
                className="text-slate-300 dark:text-slate-600"
              />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              Aucune commande
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Vous n&apos;avez pas encore passé de commande
            </p>
            <Link href="/catalog" className="btn-primary mt-6 inline-flex">
              Voir le catalogue
              <ChevronRightIcon size={16} />
            </Link>
          </div>
        ) : (
          orders.map((o) => {
            const badge = paymentLabel(o);
            const shortId = (o.order_number || o.id).replace(/^ORD-?/i, "");
            const count = itemsCount(o);
            const isPaid = o.payment_status === "paid";
            const providerLabel =
              PROVIDER_LABELS[o.payment_method || ""] || o.payment_method;

            return (
              <div
                key={o.id}
                className="card p-5 transition hover:border-slate-300 dark:hover:border-slate-600"
              >
                {/* Ligne 1 : numéro, date, badge */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Commande
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                      #{shortId.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {shortDate(o.created_at)} · {count} article
                      {count > 1 ? "s" : ""}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${badge.tone}`}
                  >
                    {badge.text}
                  </span>
                </div>

                {/* Bloc référence paiement (si payé) */}
                {isPaid && o.payment_reference && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        <ShieldCheckIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Paiement confirmé {providerLabel ? `· ${providerLabel}` : ""}
                        </p>
                        <p className="mt-0.5 break-all font-mono text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                          {o.payment_reference}
                        </p>
                        {o.paid_at && (
                          <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            {shortDateTime(o.paid_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ligne 2 : total + actions */}
                <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Total
                    </p>
                    <p className="mt-0.5 text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {formatAriary(o.total)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Bouton téléchargement facture (uniquement si payé) */}
                    {isPaid && (
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(o)}
                        disabled={downloadingId === o.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-700 dark:hover:bg-primary-950/40"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {downloadingId === o.id
                          ? "Téléchargement..."
                          : "Facture PDF"}
                      </button>
                    )}

                    {/* Bouton Payer (si non payé) */}
                    {canPay(o) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPayTarget(o)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                        >
                          Payer maintenant
                        </button>
                        {canCancel(o) && (
                          <button
                            type="button"
                            onClick={() => handleCancel(o.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
                            aria-label="Annuler la commande"
                            title="Annuler la commande"
                          >
                            <XIcon size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Note de retrait boutique (si payé et méthode boutique ou mobile) */}
                {isPaid && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <CheckIcon
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Vous pouvez récupérer votre commande à la boutique L&apos;AMI
                      (Toamasina) muni de cette référence.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal paiement */}
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