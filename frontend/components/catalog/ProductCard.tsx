"use client";

import { memo } from "react";
import Link from "next/link";
import { StarIcon, CartIcon } from "@/components/ui/icons";
import LazyImage from "@/components/ui/LazyImage";
import { formatAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import ShareProductButton from "@/components/catalog/ShareProductButton";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import {
  Discount,
  applyDiscount,
  bestDiscountForProduct,
  formatDiscountValue,
} from "@/lib/discount";

export interface ProductCardData {
  id: string;
  name: string;
  slug?: string;
  brand: string;
  price: number;
  compare_at_price?: number;
  stock: number;
  images?: string[];
  rating?: number;
  is_featured?: boolean;
  short_description?: string;
  category_id?: string;
}

export interface ProductCardProps {
  product: ProductCardData;
  discounts?: Discount[];
}

function productHref(p: ProductCardData) {
  const key = p.slug || p.id;
  return `/product/${encodeURIComponent(key)}`;
}

function ProductCard({ product: p, discounts = [] }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const href = productHref(p);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const promo = bestDiscountForProduct(discounts, {
      id: p.id,
      category_id: p.category_id,
      price: p.price,
    });
    const finalPrice = applyDiscount(p.price, promo);
    addItem({
      productId: p.id,
      name: p.name,
      price: finalPrice,
      quantity: 1,
      image: p.images?.[0],
    });
  };

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:shadow-md dark:hover:border-slate-600">
      <div className="relative">
        <Link href={href} className="relative flex h-40 items-center justify-center bg-slate-50 dark:bg-slate-800/80">
          <LazyImage
            src={p.images?.[0]}
            alt={p.name}
            fallbackText={p.brand}
          />
          {p.is_featured && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              Vedette
            </span>
          )}
          {typeof p.rating === "number" && p.rating > 0 && (
            <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
              <StarIcon size={12} className="text-amber-500" />
              {p.rating.toFixed(1)}
            </span>
          )}
        </Link>
        <FavoriteButton product={{ ...p, id: p.id }} floating size={18} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {p.brand}
        </p>
        <Link
          href={href}
          className="mt-1 line-clamp-2 font-semibold text-slate-900 transition hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
        >
          {p.name}
        </Link>
        {p.short_description && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {p.short_description}
          </p>
        )}

        <div className="mt-auto pt-3">
          {(() => {
            const promo = bestDiscountForProduct(discounts, {
              id: p.id,
              category_id: p.category_id,
              price: p.price,
            });
            const finalPrice = applyDiscount(p.price, promo);
            const hasPromo = promo && finalPrice < p.price;
            return (
              <>
                {hasPromo && (
                  <span className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    -{formatDiscountValue(promo!)} · {promo!.name}
                  </span>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {formatAriary(finalPrice)}
                  </span>
                  {(hasPromo || (p.compare_at_price && p.compare_at_price > p.price)) && (
                    <span className="text-xs text-slate-400 line-through">
                      {formatAriary(hasPromo ? p.price : (p.compare_at_price as number))}
                    </span>
                  )}
                </div>
              </>
            );
          })()}
          <p
            className={`mt-1 text-xs ${
              p.stock > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {p.stock > 0 ? `En stock (${p.stock})` : "Rupture de stock"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={p.stock <= 0}
              className="btn-primary flex-1 text-sm"
            >
              <CartIcon size={16} />
              Ajouter
            </button>
            <ShareProductButton
              productName={p.name}
              path={href}
              compact
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
