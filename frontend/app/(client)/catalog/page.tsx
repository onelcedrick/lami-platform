"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ProductCard from "@/components/catalog/ProductCard";
import SmartSearch from "@/components/search/SmartSearch";
import { filterProducts, SearchableProduct } from "@/lib/search";
import { formatAriary } from "@/lib/currency";

interface Product extends SearchableProduct {
  id: string;
  name: string;
  slug: string;
  short_description?: string;
  brand: string;
  price: number;
  compare_at_price?: number;
  stock: number;
  images: string[];
  rating: number;
  is_featured: boolean;
  usage_tags?: string[];
  tags?: string[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Discount {
  id: string;
  name: string;
  type: "percentage" | "fixed_amount";
  value: number;
  target: "global" | "category" | "product";
  target_id?: string;
  is_active: boolean;
}

function CatalogInner() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = searchParams.get("category") || "";
  const initialUsage = searchParams.get("usage") || "";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState<
    "relevance" | "popularity" | "price_asc" | "price_desc" | "name"
  >("relevance");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Charger le catalogue (large set pour recherche locale intelligente)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string> = { limit: "100" };
        if (initialUsage) params.usage = initialUsage;

        const [prodRes, catRes, discRes] = await Promise.all([
          api.listProducts(params),
          api.listCategories(),
          api.listActiveDiscounts(),
        ]);

        if (prodRes.success && prodRes.data) {
          setAllProducts(prodRes.data as Product[]);
        }
        if (catRes.success && catRes.data) {
          const cats = catRes.data as Category[];
          setCategories(cats);
          if (initialCategory) {
            const found = cats.find(
              (c) =>
                c.name.toLowerCase() === initialCategory.toLowerCase() ||
                c.slug === initialCategory
            );
            if (found) setSelectedCategory(found.id);
          }
        }
        if (discRes.success && discRes.data) {
          setDiscounts(discRes.data as Discount[]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialCategory, initialUsage]);

  // Sync search from URL
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const categoryFiltered = useMemo(() => {
    let list = allProducts;
    if (selectedCategory) {
      list = list.filter((p) => {
        const anyP = p as Product & { category_id?: string };
        return !anyP.category_id || anyP.category_id === selectedCategory;
      });
    }
    if (inStockOnly) list = list.filter((p) => p.stock > 0);
    return list;
  }, [allProducts, selectedCategory, inStockOnly]);

  // Re-fetch when category changes for accuracy
  useEffect(() => {
    if (!selectedCategory) return;
    let cancelled = false;
    (async () => {
      const res = await api.listProducts({
        limit: "100",
        category_id: selectedCategory,
      });
      if (!cancelled && res.success && res.data) {
        setAllProducts(res.data as Product[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const products = useMemo(() => {
    let list = search
      ? filterProducts(categoryFiltered, search, 48)
      : categoryFiltered;

    if (sortBy === "popularity") {
      list = [...list].sort((a, b) => {
        const score = (p: Product) =>
          ((p as any).sales_count || 0) * 50 +
          ((p as any).view_count || 0) * 2 +
          ((p as any).rating || 0) * ((p as any).review_count || 0) * 8 +
          (p.is_featured ? 100 : 0);
        return score(b) - score(a);
      });
    }
    if (sortBy === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sortBy === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [categoryFiltered, search, sortBy]);

  const handleSearch = useCallback((q: string) => {
    setSearch(q);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Catalogue
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Composants PC et configurations completes — prix en Ariary (MGA)
          </p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? "..." : `${products.length} produit${products.length > 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 lg:w-56">
          <div className="card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Categories
            </h2>
            <ul className="mt-3 space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("")}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    !selectedCategory
                      ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  Toutes
                </button>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      selectedCategory === c.id
                        ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtres
            </h2>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              En stock uniquement
            </label>
            <label className="mt-3 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Trier par
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input-field mt-1"
            >
              <option value="relevance">Pertinence</option>
              <option value="popularity">Popularite</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix decroissant</option>
              <option value="name">Nom A-Z</option>
            </select>
          </div>
        </aside>

        <div className="flex-1">
          <div className="mb-6 max-w-xl">
            <SmartSearch
              products={allProducts}
              navigateOnSubmit={false}
              onSearch={handleSearch}
              placeholder="Ex: sams, ryzen, rtx, ssd..."
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Astuce : tapez quelques lettres puis Tab pour completer (ex. sams → Samsung)
            </p>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="card h-80 animate-pulse bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="card py-16 text-center text-slate-500 dark:text-slate-400">
              Aucun produit trouve
              {search && (
                <p className="mt-2 text-sm">
                  pour &quot;{search}&quot; — essayez une autre marque ou categorie
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} discounts={discounts} />
              ))}
            </div>
          )}

          {!loading && products.length > 0 && (
            <p className="mt-8 text-center text-xs text-slate-400">
              Prix affiches en Ariary malgache (MGA). Exemple : {formatAriary(100)} pour 100 EUR de reference.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-400">
          Chargement du catalogue...
        </div>
      }
    >
      <CatalogInner />
    </Suspense>
  );
}
