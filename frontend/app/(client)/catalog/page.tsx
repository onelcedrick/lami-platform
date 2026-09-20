"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ProductCard from "@/components/catalog/ProductCard";
import SmartSearch from "@/components/search/SmartSearch";
import { filterProducts, SearchableProduct } from "@/lib/search";
import { formatAriary } from "@/lib/currency";
import {
  CpuIcon,
  ChevronRightIcon,
  FilterIcon,
  XIcon,
} from "@/components/ui/icons";

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
  category_id?: string;
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

type SortKey =
  | "relevance"
  | "popularity"
  | "price_asc"
  | "price_desc"
  | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Pertinence" },
  { value: "popularity", label: "Popularité" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name", label: "Nom (A-Z)" },
];

const USAGE_TAGS = ["gaming", "bureautique", "creation", "streaming"];

// ---------------------------------------------------------------------------
// Composant interne
// ---------------------------------------------------------------------------

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ----- Params URL (source de vérité) -----
  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSort = (searchParams.get("sort") as SortKey) || "relevance";
  const urlInStock = searchParams.get("in_stock") === "true";
  const urlUsage = searchParams.get("usage") || "";

  // ----- Données -----
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  // ----- Filtres locaux (miroir des params URL) -----
  const [search, setSearch] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState(""); // id de catégorie
  const [sortBy, setSortBy] = useState<SortKey>(urlSort);
  const [inStockOnly, setInStockOnly] = useState(urlInStock);
  const [usageFilter, setUsageFilter] = useState(urlUsage);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ----- Helpers URL -----
  const updateURL = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      });
      const qs = params.toString();
      router.replace(qs ? `/catalog?${qs}` : "/catalog", { scroll: false });
    },
    [router, searchParams]
  );

  // ----- Chargement initial -----
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [prodRes, catRes, discRes] = await Promise.all([
          api.listProducts({ limit: "100" }),
          api.listCategories(),
          api.listActiveDiscounts(),
        ]);

        if (prodRes.success && prodRes.data) {
          setAllProducts(prodRes.data as Product[]);
        }
        if (catRes.success && catRes.data) {
          const cats = catRes.data as Category[];
          setCategories(cats);
          if (urlCategory) {
            const found = cats.find(
              (c) =>
                c.name.toLowerCase() === urlCategory.toLowerCase() ||
                c.slug === urlCategory ||
                c.id === urlCategory
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
  }, [urlCategory]);

  // ----- Sync URL → state quand l'URL change (back/forward) -----
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => setSortBy(urlSort), [urlSort]);
  useEffect(() => setInStockOnly(urlInStock), [urlInStock]);
  useEffect(() => setUsageFilter(urlUsage), [urlUsage]);

  // ----- Filtrage + tri (client-side) -----
  const products = useMemo(() => {
    let list = allProducts;

    // Catégorie (bug fix : on n'inclut plus les produits sans catégorie)
    if (selectedCategory) {
      list = list.filter((p) => p.category_id === selectedCategory);
    }

    // Usage tags
    if (usageFilter) {
      list = list.filter((p) =>
        (p.usage_tags || []).some(
          (u) => u.toLowerCase() === usageFilter.toLowerCase()
        )
      );
    }

    // En stock
    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }

    // Recherche floue locale
    if (search) {
      list = filterProducts(list, search, 48);
    }

    // Tri
    const sorted = [...list];
    switch (sortBy) {
      case "popularity":
        sorted.sort((a, b) => {
          const score = (p: Product) =>
            ((p as any).sales_count || 0) * 50 +
            ((p as any).view_count || 0) * 2 +
            ((p as any).rating || 0) * ((p as any).review_count || 0) * 8 +
            (p.is_featured ? 100 : 0);
          return score(b) - score(a);
        });
        break;
      case "price_asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [allProducts, selectedCategory, usageFilter, inStockOnly, search, sortBy]);

  // ----- Handlers -----
  const handleSearchChange = useCallback(
    (q: string) => {
      setSearch(q);
      updateURL({ search: q || null });
    },
    [updateURL]
  );

  const handleCategoryChange = (cat: Category | null) => {
    setSelectedCategory(cat?.id || "");
    updateURL({ category: cat ? cat.slug || cat.name : null });
  };

  const handleSortChange = (value: SortKey) => {
    setSortBy(value);
    updateURL({ sort: value === "relevance" ? null : value });
  };

  const handleInStockToggle = (value: boolean) => {
    setInStockOnly(value);
    updateURL({ in_stock: value ? "true" : null });
  };

  const handleUsageToggle = (tag: string) => {
    const next = usageFilter === tag ? "" : tag;
    setUsageFilter(next);
    updateURL({ usage: next || null });
  };

  const resetFilters = () => {
    setSelectedCategory("");
    setInStockOnly(false);
    setUsageFilter("");
    setSearch("");
    setSortBy("relevance");
    router.replace("/catalog", { scroll: false });
  };

  // ----- Catégorie sélectionnée (objet) -----
  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  // ----- Nombre de filtres actifs (hors recherche et tri) -----
  const activeFiltersCount =
    (selectedCategory ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (usageFilter ? 1 : 0);

  const hasFilters = activeFiltersCount > 0 || !!search;

  // ----- Rendu de la sidebar (partagé desktop + drawer mobile) -----
  const SidebarContent = (
    <div className="space-y-4">
      {/* Catégories */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Catégories
        </h2>
        <ul className="mt-3 space-y-1">
          <li>
            <button
              type="button"
              onClick={() => handleCategoryChange(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                !selectedCategory
                  ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
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
                onClick={() => handleCategoryChange(c)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  selectedCategory === c.id
                    ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Usage */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Usage
        </h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {USAGE_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleUsageToggle(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                usageFilter === tag
                  ? "bg-primary-600 text-white dark:bg-primary-500"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Disponibilité */}
      <div className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Disponibilité
        </h2>
        <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => handleInStockToggle(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-800"
          />
          En stock uniquement
        </label>
      </div>

      {/* Réinitialiser */}
      {hasFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ===================== HEADER ===================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <CpuIcon size={14} />
            Catalogue
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Composants PC &amp; Configurations
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {loading
              ? "Chargement..."
              : `${products.length} produit${products.length > 1 ? "s" : ""}${
                  selectedCategoryObj ? ` dans ${selectedCategoryObj.name}` : ""
                }`}
          </p>
        </div>

        {/* Bouton filtres (mobile) */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
        >
          <FilterIcon size={16} />
          Filtres
          {activeFiltersCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* ===================== LAYOUT ===================== */}
      <div className="mt-6 flex gap-8">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">{SidebarContent}</div>
        </aside>

        {/* Contenu principal */}
        <div className="min-w-0 flex-1">
          {/* Barre recherche + tri */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SmartSearch
                products={allProducts}
                navigateOnSubmit={false}
                onSearch={handleSearchChange}
                placeholder="Rechercher (ryzen, samsung, rtx...)"
                defaultValue={search}
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
              className="input-field w-full sm:w-48"
              aria-label="Trier par"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chips de filtres actifs */}
          {hasFilters && !loading && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedCategoryObj && (
                <FilterChip
                  label={`Catégorie : ${selectedCategoryObj.name}`}
                  onRemove={() => handleCategoryChange(null)}
                />
              )}
              {usageFilter && (
                <FilterChip
                  label={`Usage : ${usageFilter}`}
                  onRemove={() => handleUsageToggle(usageFilter)}
                />
              )}
              {inStockOnly && (
                <FilterChip
                  label="En stock"
                  onRemove={() => handleInStockToggle(false)}
                />
              )}
              {search && (
                <FilterChip
                  label={`« ${search} »`}
                  onRemove={() => handleSearchChange("")}
                />
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="ml-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Tout effacer
              </button>
            </div>
          )}

          {/* Grille produits */}
          <div className="mt-6">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="card py-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <CpuIcon
                    size={28}
                    className="text-slate-300 dark:text-slate-600"
                  />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                  Aucun produit trouvé
                </h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                  {search
                    ? `Aucun résultat pour « ${search} ». Essayez une autre marque ou catégorie.`
                    : "Essayez d'élargir vos filtres."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="btn-primary mt-6 inline-flex"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      discounts={discounts}
                    />
                  ))}
                </div>

                {/* <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  Prix affichés en Ariary malgache (MGA). Exemple :{" "}
                  {formatAriary(100)} pour 100 EUR de référence.
                </p> */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===================== DRAWER MOBILE ===================== */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Filtres
              </h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fermer"
              >
                <XIcon size={20} />
              </button>
            </div>

            {SidebarContent}

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="btn-primary mt-6 w-full"
            >
              Voir les {products.length} résultat{products.length > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="group inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-3 pr-2 text-xs font-medium text-primary-700 transition hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:hover:bg-primary-500/25"
    >
      {label}
      <XIcon
        size={12}
        className="text-primary-600 transition group-hover:text-primary-800 dark:text-primary-400"
      />
    </button>
  );
}

function ProductSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-slate-100 dark:bg-slate-800" />
      <div className="space-y-3 p-4">
        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-5 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

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