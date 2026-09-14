"use client";

import { useRouter } from "next/navigation";
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
  floating?: boolean;
  size?: number;
  className?: string;
}

export default function FavoriteButton({
  product,
  floating = false,
  size = 18,
  className = "",
}: FavoriteButtonProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isFavorite = useFavoritesStore((s) => s.isFavorite(product.id));
  const toggle = useFavoritesStore((s) => s.toggle);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
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
    setTimeout(() => void pushFavoritesToServer(), 100);
  };

  // Coeur rempli UNIQUEMENT si connecte ET favori de CE compte
  const filled = isAuthenticated() && isFavorite;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={filled ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={
        isAuthenticated()
          ? filled
            ? "Retirer des favoris"
            : "Ajouter aux favoris"
          : "Connectez-vous pour ajouter aux favoris"
      }
      className={
        floating
          ? `absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105 dark:bg-slate-900 ${className}`
          : className
      }
    >
      <HeartIcon
        size={size}
        filled={filled}
        className={filled ? "text-red-500" : "text-slate-400"}
      />
    </button>
  );
}