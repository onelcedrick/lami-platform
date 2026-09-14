"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  images?: string[];
  is_featured?: boolean;
  stock: number;
}

export default function NewArrivals() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProducts({ limit: "8", featured: "true" })
      .then((res) => {
        if (res.success && res.data) {
          const list = res.data as Product[];
          setProducts(list.length > 0 ? list.slice(0, 4) : list);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fallback si pas de featured : charger normaux
  useEffect(() => {
    if (!loading && products.length === 0) {
      api.listProducts({ limit: "4" }).then((res) => {
        if (res.success && res.data) setProducts(res.data as Product[]);
      });
    }
  }, [loading, products.length]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
              Nouveaux arrives
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Decouvrez nos derniers produits
          </p>
        </div>
        <Link
          href="/catalog"
          className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Voir tout →
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/product/${encodeURIComponent((p as any).slug || p.id)}`}
              className="card group overflow-hidden transition hover:shadow-md dark:hover:border-slate-600"
            >
              <div className="relative flex h-40 items-center justify-center bg-slate-50 dark:bg-slate-800/60">
                <LazyImage
                  src={p.images?.[0]}
                  alt={p.name}
                  fallbackText={p.brand}
                />
                <span className="absolute left-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  Nouveau
                </span>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {p.name}
                </p>
                <p className="mt-2 text-base font-bold text-primary-600 dark:text-primary-400">
                  {formatAriary(p.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
