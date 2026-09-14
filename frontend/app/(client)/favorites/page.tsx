"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFavoritesStore, useCartStore } from "@/lib/store";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import { CartIcon, HeartIcon } from "@/components/ui/icons";

export default function FavoritesPage() {
  const router = useRouter();
  const items = useFavoritesStore((s) => s.items);
  const clear = useFavoritesStore((s) => s.clear);
  const addItem = useCartStore((s) => s.addItem);

  // Page masquee s'il n'y a aucun favori
  useEffect(() => {
    if (items.length === 0) {
      router.replace("/catalog");
    }
  }, [items.length, router]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <HeartIcon size={40} className="mx-auto text-slate-300" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">
          Aucun favori
        </h1>
        <p className="mt-2 text-slate-500">
          Cliquez sur le coeur d&apos;un produit pour l&apos;enregistrer ici.
        </p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
            <HeartIcon size={26} filled className="text-red-500" />
            Mes favoris
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {items.length} produit{items.length > 1 ? "s" : ""} enregistre
            {items.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          className="text-sm text-slate-500 hover:text-red-600"
        >
          Tout retirer
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const href = `/product/${encodeURIComponent(item.slug || item.productId)}`;
          return (
            <article
              key={item.productId}
              className="card relative flex flex-col overflow-hidden"
            >
              <div className="relative">
                <Link
                  href={href}
                  className="flex h-40 items-center justify-center bg-slate-50 dark:bg-slate-800/60"
                >
                  <LazyImage
                    src={item.image}
                    alt={item.name}
                    fallbackText={item.brand || "L'AMI"}
                  />
                </Link>
                <FavoriteButton
                  product={{
                    id: item.productId,
                    name: item.name,
                    slug: item.slug,
                    brand: item.brand,
                    price: item.price,
                    images: item.image ? [item.image] : [],
                    stock: item.stock,
                  }}
                  floating
                  size={18}
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                {item.brand && (
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {item.brand}
                  </p>
                )}
                <Link
                  href={href}
                  className="mt-1 line-clamp-2 font-semibold text-slate-900 hover:text-primary-600 dark:text-slate-100"
                >
                  {item.name}
                </Link>
                <p className="mt-2 text-lg font-bold text-primary-600 dark:text-primary-400">
                  {formatAriary(item.price)}
                </p>
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
                  className="btn-primary mt-3 w-full text-sm"
                >
                  <CartIcon size={16} />
                  Ajouter au panier
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
