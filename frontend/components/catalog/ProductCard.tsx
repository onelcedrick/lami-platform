"use client";

import { memo } from "react";
import Link from "next/link";
import { StarIcon, CartIcon } from "@/components/ui/icons";
import LazyImage from "@/components/ui/LazyImage";
import { formatAriary, toAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import ShareProductButton from "@/components/catalog/ShareProductButton";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import { Discount, applyDiscount, bestDiscountForProduct, formatDiscountValue } from "@/lib/discount";

export interface ProductCardData {
  id: string; name: string; slug?: string; brand: string; price: number;
  compare_at_price?: number; stock: number; images?: string[]; rating?: number;
  is_featured?: boolean; short_description?: string; category_id?: string;
}

export interface ProductCardProps { product: ProductCardData; discounts?: Discount[]; }

function productHref(p: ProductCardData) { return `/product/${encodeURIComponent(p.slug || p.id)}`; }

function ProductCard({ product: p, discounts = [] }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const href = productHref(p);

  const baseAr = toAriary(p.price);
  const promo = bestDiscountForProduct(discounts, { id: p.id, category_id: p.category_id, price: p.price });
  const finalPriceAr = promo ? applyDiscount(baseAr, promo) : baseAr;
  const hasPromo = !!promo && finalPriceAr < baseAr;
  const compareAr = p.compare_at_price && p.compare_at_price > p.price ? toAriary(p.compare_at_price) : null;
  const showStrikethrough = hasPromo || !!compareAr;
  const strikethroughPrice = hasPromo ? baseAr : compareAr;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    addItem({ productId: p.id, name: p.name, price: finalPriceAr, quantity: 1, image: p.images?.[0] });
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
      <div className="relative overflow-hidden">
        <Link href={href} className="relative flex aspect-[4/3] items-center justify-center bg-[var(--bg-muted)] p-4">
          <div className="transition-transform duration-500 group-hover:scale-105">
            <LazyImage src={p.images?.[0]} alt={p.name} fallbackText={p.brand} aspectRatio="4/3" className="bg-transparent" />
          </div>
          {p.is_featured && (
            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">Vedette</span>
          )}
          {typeof p.rating === "number" && p.rating > 0 && (
            <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-zinc-900/80 dark:text-zinc-200">
              <StarIcon size={12} className="text-amber-500" /> {p.rating.toFixed(1)}
            </span>
          )}
        </Link>
        <FavoriteButton product={{ ...p, id: p.id }} floating size={18} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{p.brand}</p>
        <Link href={href} className="mt-1 line-clamp-2 font-semibold text-[var(--fg-primary)] transition hover:text-[var(--fg-accent)] dark:hover:text-[var(--fg-accent)]">
          {p.name}
        </Link>
        {p.short_description && <p className="mt-1 line-clamp-2 text-xs text-[var(--fg-secondary)]">{p.short_description}</p>}

        <div className="mt-auto pt-3">
          {hasPromo && promo && (
            <span className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
              -{formatDiscountValue(promo)} · {promo.name}
            </span>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[var(--fg-accent)]">{formatAriary(finalPriceAr)}</span>
            {showStrikethrough && strikethroughPrice !== null && (
              <span className="text-xs text-[var(--fg-muted)] line-through">{formatAriary(strikethroughPrice)}</span>
            )}
          </div>
          <p className={`mt-1 text-xs ${p.stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {p.stock > 0 ? `En stock (${p.stock})` : "Rupture de stock"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button" onClick={handleAdd} disabled={p.stock <= 0}
              className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg bg-[var(--fg-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CartIcon size={16} className="transition-transform group-hover:-translate-y-0.5" />
              <span>Ajouter</span>
            </button>
            <ShareProductButton productName={p.name} path={href} compact className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
