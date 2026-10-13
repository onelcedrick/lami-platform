"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ProductCard, { type ProductCardData } from "@/components/catalog/ProductCard";
import { ChevronRightIcon, PackageIcon } from "@/components/ui/icons";

interface SimilarProductsProps {
  productId: string;
  categoryId?: string;
}

export default function SimilarProducts({
  productId,
  categoryId,
}: SimilarProductsProps) {
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getSimilarProducts(productId, 4);
        if (res.success && res.data) {
          setProducts(res.data as ProductCardData[]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [productId]);

  if (loading) {
    return (
      <section className="border-t border-[var(--border)] bg-[var(--bg-app)]">
        <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--bg-muted)]" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-xl bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="border-t border-[var(--border)] bg-[var(--bg-app)]">
      <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-10 xl:px-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--cyan)]/15 text-[var(--cyan)]">
                <PackageIcon size={14} />
              </span>
              <h2 className="text-xl font-extrabold text-[var(--fg-primary)] sm:text-2xl">
                Produits similaires
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-[var(--fg-secondary)]">
              Selectionnes selon categorie, marque, prix et usage
            </p>
          </div>
          {categoryId && (
            <Link
              href={`/catalog?category=${encodeURIComponent(categoryId)}`}
              className="hidden items-center gap-1 text-sm font-bold uppercase tracking-wide text-[var(--cyan)] transition hover:gap-2 sm:inline-flex"
            >
              Voir tout
              <ChevronRightIcon size={14} />
            </Link>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
