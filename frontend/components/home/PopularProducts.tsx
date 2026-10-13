"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";
import { sortByPopularity, computePopularityScore } from "@/lib/popularity";
import { StarIcon } from "@/components/ui/icons";

interface Product {
  id: string;
  name: string;
  slug?: string;
  brand: string;
  price: number;
  images?: string[];
  is_featured?: boolean;
  stock: number;
  rating?: number;
  review_count?: number;
  sales_count?: number;
  view_count?: number;
  popularity_score?: number;
  created_at?: string;
}

export default function PopularProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.listPopularProducts(8);
        if (res.success && res.data && (res.data as Product[]).length > 0) {
          setProducts(sortByPopularity(res.data as Product[], 4));
          return;
        }
        const all = await api.listProducts({ limit: "40" });
        if (all.success && all.data) {
          setProducts(sortByPopularity(all.data as Product[], 4));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-app)]">
      <div className="mx-auto w-full px-4 py-14 sm:px-6 lg:px-10 xl:px-16">
        {/* Header de section */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--orange)]/15 text-[var(--orange)]">
                <StarIcon size={14} />
              </span>
              <h2 className="text-xl font-extrabold text-[var(--fg-primary)] sm:text-2xl">
                Nos meilleurs composants
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-[var(--fg-secondary)]">
              Classement base sur les ventes, vues, notes et nouveautes
            </p>
          </div>
          <Link
            href="/catalog?sort=popularity"
            className="hidden items-center gap-1 text-sm font-bold uppercase tracking-wide text-[var(--cyan)] transition hover:gap-2 sm:inline-flex"
          >
            Voir tout
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* Grille produits */}
        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-xl bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="mt-10 text-center text-sm text-[var(--fg-muted)]">
            Pas encore de donnees de popularite
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, index) => {
              const score = Math.round(computePopularityScore(p));
              const href = `/product/${encodeURIComponent(p.slug || p.id)}`;
              return (
                <Link
                  key={p.id}
                  href={href}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all hover:-translate-y-1 hover:border-[var(--cyan)]/40 hover:shadow-xl"
                >
                  {/* Badge rang */}
                  <div className="absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cyan)] text-[11px] font-extrabold text-[var(--navy-deep)] shadow-md">
                    #{index + 1}
                  </div>

                  {/* Image - hauteur fixe */}
                  <div className="relative h-48 w-full overflow-hidden bg-[var(--bg-muted)]">
                    <LazyImage
                      src={p.images?.[0]}
                      alt={p.name}
                      fallbackText={p.brand}
                      fill
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Contenu */}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {p.brand}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--fg-primary)] group-hover:text-[var(--cyan)]">
                      {p.name}
                    </p>

                    {/* Rating + ventes */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                      {(p.rating ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[var(--orange)] font-semibold">
                          <StarIcon size={12} className="fill-current" />
                          {p.rating?.toFixed(1)}
                        </span>
                      )}
                      {(p.sales_count ?? 0) > 0 && (
                        <span>{p.sales_count} ventes</span>
                      )}
                    </div>

                    {/* Prix - pousse en bas */}
                    <div className="mt-auto pt-3">
                      <p className="text-lg font-extrabold text-[var(--cyan)]">
                        {formatAriary(p.price)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--fg-muted)]">
                        Score : {score}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
