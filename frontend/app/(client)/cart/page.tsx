"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, useCartStore } from "@/lib/store";
import { api } from "@/lib/api";
import { pushCartToServer } from "@/lib/sync-account";
import { formatAriary } from "@/lib/currency";
import { logActivity } from "@/lib/analytics";
import LazyImage from "@/components/ui/LazyImage";

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { items, removeItem, updateQuantity, total, clear, count } = useCartStore();
  const [address, setAddress] = useState({
    street: "",
    city: "Toamasina",
    postal_code: "301",
    country: "Madagascar",
    region: "Haute Matsiatra",
  });
  const [showAddress, setShowAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const shippingFree = true;
  const grandTotal = total();

  const handleCheckout = async () => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (items.length === 0) return;

    // Paiement en boutique : adresse minimale pre-remplie Toamasina
    if (!address.city) {
      setShowAddress(true);
      setError("Indiquez au moins la ville de livraison / retrait");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.createOrder({
        items: items.map((i) => ({
          product_id: i.productId,
          quantity: i.quantity,
        })),
        shipping_address: {
          street: address.street || "Retrait en boutique",
          city: address.city,
          postal_code: address.postal_code || "301",
          country: address.country,
          region: address.region,
          province: "Toamasina",
          country_code: "MG",
        },
        payment_method: "store",
      });

      if (res.success) {
        clear();
        logActivity({
          action: "order_created",
          category: "order",
          message: "Commande creee (paiement boutique)",
          resource: "order",
        });
        setSuccess("Commande creee — paiement en boutique ou Mobile Money depuis Mes commandes");
        setTimeout(() => router.push("/orders"), 1200);
      } else {
        setError(res.error || "Erreur lors de la commande");
      }
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  };

  if (count() === 0 && !success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          Mon Panier
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Votre panier est vide
        </p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl sm:py-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        Mon Panier ({count()})
      </h1>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80"
          >
            <div className="flex gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                <LazyImage
                  src={item.image}
                  alt={item.name}
                  fallbackText={item.name.slice(0, 4)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-primary-600 dark:text-primary-400">
                      {formatAriary(item.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700"
                    aria-label="Retirer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          Math.max(1, item.quantity - 1)
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-white"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-white"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatAriary(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Adresse optionnelle */}
      <button
        type="button"
        onClick={() => setShowAddress(!showAddress)}
        className="mt-4 text-sm text-primary-600 dark:text-primary-400"
      >
        {showAddress ? "Masquer l'adresse" : "Adresse de livraison / retrait"}
      </button>
      {showAddress && (
        <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <input
            placeholder="Rue / quartier"
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
            className="input-field"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Ville"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              className="input-field"
            />
            <input
              placeholder="Code postal"
              value={address.postal_code}
              onChange={(e) =>
                setAddress({ ...address, postal_code: e.target.value })
              }
              className="input-field"
            />
          </div>
        </div>
      )}

      {/* Totaux */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Sous-total</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatAriary(grandTotal)}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>Livraison</span>
          <span className="font-medium text-emerald-500">
            {shippingFree ? "Gratuite" : formatAriary(5000)}
          </span>
        </div>
        <div className="my-3 border-t border-slate-200 dark:border-slate-600" />
        <div className="flex justify-between text-base font-semibold">
          <span className="text-slate-900 dark:text-white">Total</span>
          <span className="text-primary-600 dark:text-primary-400">
            {formatAriary(grandTotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={submitting || items.length === 0}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting
            ? "Traitement..."
            : "Commander (Paiement en boutique)"}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Apres commande, payez en boutique ou via Mobile Money (MVola, Orange, Airtel)
        </p>
      </div>
    </div>
  );
}
