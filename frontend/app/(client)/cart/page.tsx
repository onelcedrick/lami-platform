"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, useCartStore } from "@/lib/store";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import { logActivity } from "@/lib/analytics";
import LazyImage from "@/components/ui/LazyImage";
import {
  CartIcon,
  ChevronRightIcon,
  TrashIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { items, removeItem, updateQuantity, total, clear, count } =
    useCartStore();

  const [address, setAddress] = useState({
    street: "",
    city: "Toamasina",
    postal_code: "501",
    country: "Madagascar",
    region: "Haute Matsiatra",
  });
  const [showAddress, setShowAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const grandTotal = total();

  const handleCheckout = async () => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (items.length === 0) return;
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
          message: "Commande créée (paiement boutique)",
          resource: "order",
        });
        setSuccess(
          "Commande créée — paiement en boutique ou Mobile Money depuis Mes commandes"
        );
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

  // ----- État vide -----
  if (count() === 0 && !success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <CartIcon
            size={32}
            className="text-slate-300 dark:text-slate-600"
          />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Votre panier est vide
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Découvrez nos composants PC et configurations
        </p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Parcourir le catalogue
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Mon panier
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {count()} article{count() > 1 ? "s" : ""} dans votre panier
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Liste articles */}
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="card p-4 transition hover:border-slate-300 dark:hover:border-slate-600"
            >
              <div className="flex gap-4">
                {/* Image */}
                <Link
                  href={`/product/${item.productId}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <LazyImage
                    src={item.image}
                    alt={item.name}
                    fallbackText={item.name.slice(0, 4)}
                    fill
                  />
                </Link>

                {/* Contenu */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.productId}`}
                        className="line-clamp-2 font-medium text-slate-900 transition hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-primary-600 dark:text-primary-400">
                        {formatAriary(item.price)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label="Retirer du panier"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>

                  {/* Quantité */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            Math.max(1, item.quantity - 1)
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Diminuer"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label="Augmenter"
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

          {/* Continuer achats */}
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
          >
            ← Continuer mes achats
          </Link>
        </div>

        {/* Récapitulatif */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Récapitulatif
            </h2>

            {/* Sous-total */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Sous-total</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatAriary(grandTotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Livraison</span>
                <span className="font-medium text-emerald-500">
                  Gratuite
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Total
              </span>
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {formatAriary(grandTotal)}
              </span>
            </div>

            {/* Bouton commander */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={submitting || items.length === 0}
              className="btn-primary mt-5 w-full py-3"
            >
              {submitting ? "Traitement..." : "Commander"}
            </button>

            {/* Adresse */}
            <button
              type="button"
              onClick={() => setShowAddress(!showAddress)}
              className="mt-3 w-full text-center text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {showAddress
                ? "Masquer l'adresse"
                : "Ajouter une adresse de livraison"}
            </button>

            {showAddress && (
              <div className="mt-3 space-y-2">
                <input
                  placeholder="Rue / quartier"
                  value={address.street}
                  onChange={(e) =>
                    setAddress({ ...address, street: e.target.value })
                  }
                  className="input-field text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Ville"
                    value={address.city}
                    onChange={(e) =>
                      setAddress({ ...address, city: e.target.value })
                    }
                    className="input-field text-sm"
                  />
                  <input
                    placeholder="Code postal"
                    value={address.postal_code}
                    onChange={(e) =>
                      setAddress({ ...address, postal_code: e.target.value })
                    }
                    className="input-field text-sm"
                  />
                </div>
              </div>
            )}

            {/* Garantie */}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <ShieldCheckIcon
                size={16}
                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
              />
              <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                Paiement en boutique ou via Mobile Money (MVola, Orange, Airtel)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}