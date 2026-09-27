"use client";

import Link from "next/link";
import { memo } from "react";
import { StarIcon, CartIcon } from "@/components/ui/icons";
import LazyImage from "@/components/ui/LazyImage";
import { formatAriary, toAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import FavoriteButton from "./FavoriteButton";
import {
  Discount,
  applyDiscount,
  bestDiscountForProduct,
  formatDiscountValue,
} from "@/lib/discount";
import type { ProductCardData } from "./ProductCard";

interface Props {
  product: ProductCardData;
  discounts?: Discount[];
}

function ProductListItem({ product: p, discounts = [] }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const href = `/product/${encodeURIComponent(p.slug || p.id)}`;

  const baseAr = toAriary(p.price);
  const promo = bestDiscountForProduct(discounts, {
    id: p.id,
    category_id: p.category_id,
    price: p.price,
  });
  const finalPriceAr = promo ? applyDiscount(baseAr, promo) : baseAr;
  const hasPromo = !!promo && finalPriceAr < baseAr;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: p.id,
      name: p.name,
      price: finalPriceAr,
      quantity: 1,
      image: p.images?.[0],
    });
  };

  return (
    <article className="card group flex gap-4 overflow-hidden p-4 transition hover:shadow-md">
      {/* Image */}
      <Link
        href={href}
        className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800 sm:h-40 sm:w-40"
      >
        <LazyImage src={p.images?.[0]} alt={p.name} fallbackText={p.brand} fill />
      </Link>

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {p.brand}
            </p>
            <Link
              href={href}
              className="mt-1 line-clamp-2 text-base font-semibold text-slate-900 transition hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
            >
              {p.name}
            </Link>
            {typeof p.rating === "number" && p.rating > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-sm">
                <StarIcon size={14} className="text-amber-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {p.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
          <FavoriteButton product={{ ...p, id: p.id }} size={20} />
        </div>

        {p.short_description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {p.short_description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-4 pt-3">
          <div>
            {hasPromo && promo && (
              <span className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                -{formatDiscountValue(promo)}
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                {formatAriary(finalPriceAr)}
              </span>
              {hasPromo && (
                <span className="text-sm text-slate-400 line-through">
                  {formatAriary(baseAr)}
                </span>
              )}
            </div>
            <p
              className={`mt-0.5 text-xs ${
                p.stock > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500"
              }`}
            >
              {p.stock > 0 ? `En stock (${p.stock})` : "Rupture"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={p.stock <= 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            <CartIcon size={16} />
            Ajouter
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductListItem);