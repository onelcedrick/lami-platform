"use client";

import { HeartIcon } from "@/components/ui/icons";
import { useFavoritesStore, useAuthStore, type FavoriteItem } from "@/lib/store";
import { pushFavoritesToServer } from "@/lib/sync-account";

interface FavoriteButtonProps {
  product: {
    id: string;
    name: string;
    slug?: string;
    brand?: string;
    price: number;
    images?: string[];
    stock?: number;
  };
  className?: string;
  size?: number;
  /** Si true, position absolute coin (carte produit) */
  floating?: boolean;
}

export default function FavoriteButton({
  product,
  className = "",
  size = 20,
  floating = false,
}: FavoriteButtonProps) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(product.id));
  const toggle = useFavoritesStore((s) => s.toggle);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const item: FavoriteItem = {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      price: product.price,
      image: product.images?.[0],
      stock: product.stock,
    };
    toggle(item);
    if (useAuthStore.getState().isAuthenticated()) {
      setTimeout(() => void pushFavoritesToServer(), 100);
    }
  };

  const base =
    floating
      ? "absolute right-2 bottom-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:scale-105 dark:bg-slate-900/90"
      : "inline-flex items-center justify-center rounded-full p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${className}`}
      aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <HeartIcon
        size={size}
        filled={isFavorite}
        className={
          isFavorite
            ? "text-red-500 transition"
            : "text-slate-400 transition hover:text-red-400"
        }
      />
    </button>
  );
}
