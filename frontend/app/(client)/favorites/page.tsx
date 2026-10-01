"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFavoritesStore, useCartStore, useAuthStore } from "@/lib/store";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";
import { HeartIcon, ChevronRightIcon, CartIcon } from "@/components/ui/icons";

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const items = useFavoritesStore((s) => s.items);
  const clear = useFavoritesStore((s) => s.clear);
  const remove = useFavoritesStore((s) => s.remove);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated()) return null;

  // ----- État vide -----
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-muted)]">
          <HeartIcon
            size={32}
            className="text-[var(--fg-muted)]"
          />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--fg-primary)]">
          Aucun favori pour le moment
        </h1>
        <p className="mt-2 text-[var(--fg-secondary)]">
          Ajoutez des produits à vos favoris pour les retrouver facilement
        </p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Découvrir le catalogue
          <ChevronRightIcon size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)]">
            <HeartIcon size={14} filled className="text-red-500" />
            Mes favoris
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--fg-primary)] sm:text-3xl">
            {items.length} produit{items.length > 1 ? "s" : ""} favori
            {items.length > 1 ? "s" : ""}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          className="text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Tout retirer
        </button>
      </div>

      {/* Grille */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="group card relative flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lg "
          >
            {/* Image */}
            <Link
              href={`/product/${encodeURIComponent(item.slug || item.productId)}`}
              className="relative block aspect-[4/3] overflow-hidden bg-[var(--bg-muted)]"
            >
              <LazyImage
                src={item.image}
                alt={item.name}
                fallbackText={item.brand || "LAMI"}
                fill
                className="transition-transform duration-500 group-hover:scale-105"
              />
            </Link>

            {/* Bouton retirer (flottant) */}
            <button
              type="button"
              onClick={() => remove(item.productId)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-sm backdrop-blur transition hover:bg-white hover:scale-110 dark:bg-zinc-900/90 dark:hover:bg-zinc-900"
              aria-label="Retirer des favoris"
            >
              <HeartIcon size={16} filled />
            </button>

            {/* Contenu */}
            <div className="flex flex-1 flex-col p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                {item.brand}
              </p>
              <Link
                href={`/product/${encodeURIComponent(item.slug || item.productId)}`}
                className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 transition hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
              >
                {item.name}
              </Link>

              <div className="mt-auto pt-3">
                <p className="text-lg font-bold text-[var(--fg-accent)]">
                  {formatAriary(item.price)}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      addItem({
                        productId: item.productId,
                        name: item.name,
                        price: item.price,
                        quantity: 1,
                        image: item.image,
                      })
                    }
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--fg-accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    <CartIcon size={15} />
                    Ajouter
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}