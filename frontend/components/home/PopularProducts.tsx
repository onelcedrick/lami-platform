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
        // Endpoint dédié popularité
        const res = await api.listPopularProducts(8);
        if (res.success && res.data && (res.data as Product[]).length > 0) {
          setProducts(sortByPopularity(res.data as Product[], 4));
          return;
        }
        // Fallback : catalogue + ranking local
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
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <StarIcon size={14} />
            </span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
              Produits populaires
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Classes selon ventes, vues, notes et nouveaute
          </p>
        </div>
        <Link
          href="/catalog?sort_by=popularity"
          className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Voir le classement →
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          Pas encore de donnees de popularite
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p, index) => {
            const score = Math.round(computePopularityScore(p));
            return (
              <Link
                key={p.id}
                href={`/product/${encodeURIComponent((p as any).slug || p.id)}`}
                className="card group relative overflow-hidden transition hover:shadow-md dark:hover:border-slate-600"
              >
                <div className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white shadow">
                  #{index + 1}
                </div>
                <div className="relative flex h-40 items-center justify-center bg-slate-50 dark:bg-slate-800/60">
                  <LazyImage
                    src={p.images?.[0]}
                    alt={p.name}
                    fallbackText={p.brand}
                  />
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {p.brand}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {(p.rating ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        <StarIcon size={12} />
                        {p.rating?.toFixed(1)}
                      </span>
                    )}
                    {(p.sales_count ?? 0) > 0 && (
                      <span>{p.sales_count} ventes</span>
                    )}
                  </div>
                  <p className="mt-2 text-base font-bold text-primary-600 dark:text-primary-400">
                    {formatAriary(p.price)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Score popularite : {score}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
