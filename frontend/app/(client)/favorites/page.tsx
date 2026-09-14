"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFavoritesStore, useCartStore, useAuthStore } from "@/lib/store";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";

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

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mes favoris</h1>
        <p className="mt-2 text-slate-500">Aucun produit favori pour le moment.</p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Mes favoris ({items.length})
        </h1>
        <button type="button" onClick={() => clear()} className="text-sm text-red-600 hover:underline">
          Tout retirer
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className="card flex flex-col overflow-hidden p-4"
          >
            <Link href={`/product/${item.slug || item.productId}`} className="flex h-32 items-center justify-center bg-slate-50 dark:bg-slate-800">
              <LazyImage src={item.image} alt={item.name} fallbackText={item.brand || "LAMI"} />
            </Link>
            <p className="mt-2 text-xs uppercase text-slate-400">{item.brand}</p>
            <Link
              href={`/product/${item.slug || item.productId}`}
              className="font-semibold text-slate-900 hover:text-primary-600 dark:text-white"
            >
              {item.name}
            </Link>
            <p className="mt-1 font-bold text-primary-600">{formatAriary(item.price)}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1 text-sm"
                onClick={() =>
                  addItem({
                    productId: item.productId,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                    image: item.image,
                  })
                }
              >
                Ajouter au panier
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => remove(item.productId)}
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}