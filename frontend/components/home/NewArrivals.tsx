"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import LazyImage from "@/components/ui/LazyImage";
import { ZapIcon } from "@/components/ui/icons";

interface Product {
  id: string;
  name: string;
  slug?: string;
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

  useEffect(() => {
    if (!loading && products.length === 0) {
      api.listProducts({ limit: "4" }).then((res) => {
        if (res.success && res.data) setProducts(res.data as Product[]);
      });
    }
  }, [loading, products.length]);

  return (
    <section className="border-b border-[var(--border)] bg-[var(--bg-app)]">
      <div className="mx-auto w-full px-4 py-14 sm:px-6 lg:px-10 xl:px-16">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cyan)]/15 text-[var(--cyan)]">
                <ZapIcon size={14} />
              </span>
              <h2 className="text-xl font-extrabold text-[var(--fg-primary)] sm:text-2xl">
                Nouveaux arrives
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-[var(--fg-secondary)]">
              Decouvrez nos derniers produits
            </p>
          </div>
          <Link
            href="/catalog"
            className="hidden items-center gap-1 text-sm font-bold uppercase tracking-wide text-[var(--cyan)] transition hover:gap-2 sm:inline-flex"
          >
            Voir tout
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[380px] animate-pulse rounded-xl bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const href = `/product/${encodeURIComponent(p.slug || p.id)}`;
              return (
                <Link
                  key={p.id}
                  href={href}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all hover:-translate-y-1 hover:border-[var(--cyan)]/40 hover:shadow-xl"
                >
                  {/* Image - hauteur fixe */}
                  <div className="relative h-48 w-full overflow-hidden bg-[var(--bg-muted)]">
                    <LazyImage
                      src={p.images?.[0]}
                      alt={p.name}
                      fallbackText={p.brand}
                      fill
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Badge Nouveau */}
                    <span className="absolute left-3 top-3 rounded-md bg-[var(--cyan)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--navy-deep)] shadow-md">
                      Nouveau
                    </span>
                  </div>

                  {/* Contenu */}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                      {p.brand}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--fg-primary)] group-hover:text-[var(--cyan)]">
                      {p.name}
                    </p>

                    {/* Prix - pousse en bas */}
                    <div className="mt-auto pt-3">
                      <p className="text-lg font-extrabold text-[var(--cyan)]">
                        {formatAriary(p.price)}
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
