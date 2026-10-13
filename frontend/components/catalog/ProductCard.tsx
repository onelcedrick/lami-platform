"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { StarIcon, CartIcon, CheckIcon } from "@/components/ui/icons";
import LazyImage from "@/components/ui/LazyImage";
import { formatAriary, toAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import ShareProductButton from "@/components/catalog/ShareProductButton";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import { Discount, applyDiscount, bestDiscountForProduct, formatDiscountValue } from "@/lib/discount";

export interface ProductCardData {
  id: string;
  name: string;
  slug?: string;
  brand: string;
  price: number;
  compare_at_price?: number;
  stock: number;
  stock_alert?: number;
  images?: string[];
  rating?: number;
  review_count?: number;
  is_featured?: boolean;
  short_description?: string;
  category_id?: string;
  created_at?: string;
}

export interface ProductCardProps {
  product: ProductCardData;
  discounts?: Discount[];
}

function productHref(p: ProductCardData) {
  return `/product/${encodeURIComponent(p.slug || p.id)}`;
}

function ProductCard({ product: p, discounts = [] }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const href = productHref(p);

  const baseAr = toAriary(p.price);
  const promo = bestDiscountForProduct(discounts, {
    id: p.id,
    category_id: p.category_id,
    price: p.price,
  });
  const finalPriceAr = promo ? applyDiscount(baseAr, promo) : baseAr;
  const hasPromo = !!promo && finalPriceAr < baseAr;
  const compareAr =
    p.compare_at_price && p.compare_at_price > p.price
      ? toAriary(p.compare_at_price)
      : null;
  const showStrikethrough = hasPromo || !!compareAr;
  const strikethroughPrice = hasPromo ? baseAr : compareAr;

  // Calcul du pourcentage de promo
  const discountPct =
    hasPromo && strikethroughPrice
      ? Math.round(((strikethroughPrice - finalPriceAr) / strikethroughPrice) * 100)
      : null;

  // "Nouveau" si créé dans les 30 derniers jours
  const isNew = p.created_at
    ? Date.now() - new Date(p.created_at).getTime() < 30 * 24 * 60 * 60 * 1000
    : false;

  // "Stock bas" si stock <= stock_alert
  const lowStock =
    p.stock > 0 && p.stock <= (p.stock_alert || 5);

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
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  // Déterminer le badge principal (priorité)
  let mainBadge: { label: string; className: string } | null = null;
  if (hasPromo && discountPct) {
    mainBadge = {
      label: `-${discountPct}%`,
      className: "bg-[var(--orange)] text-white",
    };
  } else if (isNew) {
    mainBadge = {
      label: "Nouveau",
      className: "bg-[var(--cyan)] text-[var(--navy-deep)]",
    };
  } else if (p.is_featured) {
    mainBadge = {
      label: "Top",
      className: "bg-[var(--cyan)] text-[var(--navy-deep)]",
    };
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--cyan)]/40 hover:shadow-xl">
      {/* ============ IMAGE ============ */}
      <div className="relative overflow-hidden">
        <Link
          href={href}
          className="relative flex aspect-square items-center justify-center bg-[var(--bg-muted)] p-4"
        >
          <div className="transition-transform duration-500 group-hover:scale-105">
            <LazyImage
              src={p.images?.[0]}
              alt={p.name}
              fallbackText={p.brand}
              aspectRatio="1/1"
              className="bg-transparent"
            />
          </div>
        </Link>

        {/* Badge principal (Promo > Nouveau > Top) */}
        {mainBadge && (
          <span
            className={`absolute left-3 top-3 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${mainBadge.className}`}
          >
            {mainBadge.label}
          </span>
        )}

        {/* Badge stock bas (si pas de promo) */}
        {!hasPromo && lowStock && (
          <span className="absolute right-3 top-3 rounded-md bg-[var(--orange)] px-2 py-1 text-[10px] font-bold uppercase text-white shadow-sm">
            Stock bas
          </span>
        )}

        {/* Rating */}
        {typeof p.rating === "number" && p.rating > 0 && (
          <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <StarIcon size={10} className="text-[var(--cyan)]" />
            {p.rating.toFixed(1)}
          </span>
        )}

        {/* Favorite */}
        <FavoriteButton product={{ ...p, id: p.id }} floating size={18} />
      </div>

      {/* ============ CONTENU ============ */}
      <div className="flex flex-1 flex-col p-4">
        {/* Marque */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
          {p.brand}
        </p>

        {/* Nom */}
        <Link
          href={href}
          className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--fg-primary)] transition hover:text-[var(--cyan)]"
        >
          {p.name}
        </Link>

        {/* Description courte */}
        {p.short_description && (
          <p className="mt-1 line-clamp-1 text-xs text-[var(--fg-secondary)]">
            {p.short_description}
          </p>
        )}

        {/* Rating + reviews (optionnel) */}
        {typeof p.rating === "number" && p.rating > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon
                  key={i}
                  size={10}
                  className={
                    i < Math.round(p.rating || 0)
                      ? "text-[var(--orange)]"
                      : "text-[var(--fg-muted)]/30"
                  }
                />
              ))}
            </span>
            <span className="text-[var(--fg-muted)]">
              {p.review_count ? `${p.review_count} avis` : ""}
            </span>
          </div>
        )}

        {/* Prix + Stock */}
        <div className="mt-auto pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[var(--cyan)]">
              {formatAriary(finalPriceAr)}
            </span>
            {showStrikethrough && strikethroughPrice !== null && (
              <span className="text-xs text-[var(--fg-muted)] line-through">
                {formatAriary(strikethroughPrice)}
              </span>
            )}
          </div>

          {/* Stock badge */}
          <div className="mt-1">
            {p.stock > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[var(--success)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                <CheckIcon size={10} />
                En stock
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                Rupture
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={p.stock <= 0}
              className="group/btn relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg bg-[var(--cyan)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[var(--navy-deep)] transition-all hover:bg-[var(--cyan-hover)] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {added ? (
                <>
                  <CheckIcon size={14} />
                  <span>Ajouté</span>
                </>
              ) : (
                <>
                  <CartIcon size={14} />
                  <span>Ajouter au panier</span>
                </>
              )}
            </button>
            <ShareProductButton
              productName={p.name}
              path={href}
              compact
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 text-[var(--fg-secondary)] transition hover:border-[var(--cyan)]/40 hover:bg-[var(--bg-muted)] hover:text-[var(--cyan)]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
