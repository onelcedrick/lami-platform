"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, useCartStore } from "@/lib/store";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import { logActivity } from "@/lib/analytics";
import LazyImage from "@/components/ui/LazyImage";
import AnimatedSection from "@/components/ui/AnimatedSection";
import { CartIcon, ChevronRightIcon, TrashIcon, ShieldCheckIcon, MapPinIcon } from "@/components/ui/icons";

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { items, removeItem, updateQuantity, total, clear, count } = useCartStore();

  const [address, setAddress] = useState({ street: "", city: "Toamasina", postal_code: "501", country: "Madagascar", region: "Toamasina" });
  const [showAddress, setShowAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const grandTotal = total();

  const handleCheckout = async () => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    if (items.length === 0) return;
    if (!address.city) { setShowAddress(true); setError("Indiquez au moins la ville de livraison / retrait"); return; }

    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await api.createOrder({
        items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        shipping_address: {
          street: address.street || "Retrait en boutique",
          city: address.city,
          postal_code: address.postal_code || "501",
          country: address.country,
          region: address.region,
          province: "Toamasina",
          country_code: "MG",
        },
        payment_method: "store",
      });

      if (res.success) {
        clear();
        logActivity({ action: "order_created", category: "order", message: "Commande créée (paiement boutique)", resource: "order" });
        setSuccess("Commande créée avec succès ! Vous pourrez choisir Mobile Money ou payer en boutique.");
        setTimeout(() => router.push("/orders"), 1500);
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
      <AnimatedSection className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-muted)]">
          <CartIcon size={32} className="text-[var(--fg-muted)]" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--fg-primary)]">Votre panier est vide</h1>
        <p className="mt-2 text-[var(--fg-secondary)]">Découvrez nos composants PC et configurations</p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">Parcourir le catalogue <ChevronRightIcon size={16} /></Link>
      </AnimatedSection>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AnimatedSection>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--fg-primary)] sm:text-3xl">Mon panier</h1>
        <p className="mt-1 text-sm text-[var(--fg-secondary)]">{count()} article{count() > 1 ? "s" : ""} dans votre panier</p>
      </AnimatedSection>

      {error && <AnimatedSection className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</AnimatedSection>}
      {success && <AnimatedSection className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</AnimatedSection>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Liste articles */}
        <AnimatedSection delay={0.1} className="space-y-3 lg:col-span-2">
          {items.map((item) => (
            <div key={item.productId} className="card p-4 transition hover:border-[var(--border-strong)]">
              <div className="flex gap-4">
                <Link href={`/product/${item.productId}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-muted)]">
                  <LazyImage src={item.image} alt={item.name} fallbackText={item.name.slice(0, 4)} aspectRatio="1/1" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${item.productId}`} className="line-clamp-2 font-medium text-[var(--fg-primary)] transition hover:text-[var(--fg-accent)]">
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm font-semibold text-[var(--fg-accent)]">{formatAriary(item.price)}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(item.productId)} className="shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" aria-label="Retirer du panier">
                      <TrashIcon size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-app)]">
                      <button type="button" onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-l-lg text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)]" aria-label="Diminuer">−</button>
                      <span className="min-w-[2rem] text-center text-sm font-medium text-[var(--fg-primary)]">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-r-lg text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)]" aria-label="Augmenter">+</button>
                    </div>
                    <p className="text-sm font-bold text-[var(--fg-primary)]">{formatAriary(item.price * item.quantity)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Link href="/catalog" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--fg-secondary)] transition hover:text-[var(--fg-accent)]">
            ← Continuer mes achats
          </Link>
        </AnimatedSection>

        {/* Récapitulatif */}
        <AnimatedSection delay={0.2} className="lg:col-span-1">
          <div className="card sticky top-24 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--fg-muted)]">Récapitulatif</h2>
            <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
              <div className="flex justify-between text-sm text-[var(--fg-secondary)]">
                <span>Sous-total</span>
                <span className="font-medium text-[var(--fg-primary)]">{formatAriary(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-[var(--fg-secondary)]">
                <span>Livraison</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Gratuite</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4">
              <span className="text-base font-semibold text-[var(--fg-primary)]">Total</span>
              <span className="text-lg font-bold text-[var(--fg-accent)]">{formatAriary(grandTotal)}</span>
            </div>

            <button type="button" onClick={handleCheckout} disabled={submitting || items.length === 0} className="btn-primary mt-5 w-full py-3 text-base disabled:opacity-70">
              {submitting ? "Traitement en cours..." : "Passer la commande"}
            </button>

            <button type="button" onClick={() => setShowAddress(!showAddress)} className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-medium text-[var(--fg-accent)] transition hover:underline">
              <MapPinIcon size={14} />
              {showAddress ? "Masquer l'adresse de livraison" : "Ajouter une adresse de livraison"}
            </button>

            {showAddress && (
              <div className="mt-3 space-y-3 rounded-lg bg-[var(--bg-muted)] p-3">
                <input placeholder="Rue / Quartier (optionnel)" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]" />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Ville *" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]" />
                  <input placeholder="Code postal" value={address.postal_code} onChange={(e) => setAddress({ ...address, postal_code: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] focus:border-[var(--fg-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--fg-accent)]" />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <ShieldCheckIcon size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                Paiement sécurisé en boutique ou via Mobile Money (MVola, Orange, Airtel) après confirmation.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
