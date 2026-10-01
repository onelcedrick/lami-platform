"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import ProductCard from "@/components/catalog/ProductCard";
import ProductListItem from "@/components/catalog/ProductListItem";
import FilterSidebar from "@/components/catalog/FilterSidebar";
import CatalogToolbar, { SortKey, ViewMode } from "@/components/catalog/CatalogToolbar";
import { filterProducts, SearchableProduct } from "@/lib/search";
import { CpuIcon, FilterIcon, XIcon, ChevronDownIcon } from "@/components/ui/icons";
import AnimatedSection from "@/components/ui/AnimatedSection";

interface Product extends SearchableProduct {
  id: string; name: string; slug: string; short_description?: string; brand: string;
  price: number; compare_at_price?: number; stock: number; images: string[];
  rating: number; is_featured: boolean; usage_tags?: string[]; tags?: string[]; category_id?: string;
}

interface Category { id: string; name: string; slug: string; }
interface Discount { id: string; name: string; type: "percentage" | "fixed_amount"; value: number; target: "global" | "category" | "product"; target_id?: string; is_active: boolean; }

const USAGE_TAGS = ["gaming", "bureautique", "creation", "streaming"];
const PAGE_SIZE = 12;

function CatalogInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSort = (searchParams.get("sort") as SortKey) || "relevance";
  const urlInStock = searchParams.get("in_stock") === "true";
  const urlUsage = searchParams.get("usage") || "";
  const urlBrands = searchParams.get("brands")?.split(",").filter(Boolean) || [];
  const urlMinPrice = searchParams.get("min_price");
  const urlMaxPrice = searchParams.get("max_price");

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(urlSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>(urlSort);
  const [inStockOnly, setInStockOnly] = useState(urlInStock);
  const [usageFilter, setUsageFilter] = useState(urlUsage);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(urlBrands);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const updateURL = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    });
    const qs = params.toString();
    router.replace(qs ? `/catalog?${qs}` : "/catalog", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [prodRes, catRes, discRes] = await Promise.all([
          api.listProducts({ limit: "1000" }), api.listCategories(), api.listActiveDiscounts(),
        ]);
        if (prodRes.success && prodRes.data) {
          const products = prodRes.data as Product[];
          setAllProducts(products);
          if (products.length > 0) {
            const prices = products.map((p) => p.price);
            setPriceRange([urlMinPrice ? Number(urlMinPrice) : Math.min(...prices), urlMaxPrice ? Number(urlMaxPrice) : Math.max(...prices)]);
          }
        }
        if (catRes.success && catRes.data) {
          const cats = catRes.data as Category[];
          setCategories(cats);
          if (urlCategory) {
            const found = cats.find((c) => c.name.toLowerCase() === urlCategory.toLowerCase() || c.slug === urlCategory || c.id === urlCategory);
            if (found) setSelectedCategory(found.id);
          }
        }
        if (discRes.success && discRes.data) setDiscounts(discRes.data as Discount[]);
      } catch { /* silent */ } finally { setLoading(false); }
    }
    load();
  }, [urlCategory, urlMinPrice, urlMaxPrice]);

  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => setSortBy(urlSort), [urlSort]);
  useEffect(() => setInStockOnly(urlInStock), [urlInStock]);
  useEffect(() => setUsageFilter(urlUsage), [urlUsage]);
  useEffect(() => setSelectedBrands(urlBrands), [urlBrands.join(",")]);

  const priceBounds: [number, number] = useMemo(() => {
    if (allProducts.length === 0) return [0, 10000000];
    const prices = allProducts.map((p) => p.price);
    return [Math.min(...prices), Math.max(...prices)];
  }, [allProducts]);

  const availableBrands = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((p) => { if (p.brand) map.set(p.brand, (map.get(p.brand) || 0) + 1); });
    return Array.from(map.entries()).map(([brand, count]) => ({ brand, count })).sort((a, b) => b.count - a.count);
  }, [allProducts]);

  const products = useMemo(() => {
    let list = allProducts;
    if (selectedCategory) list = list.filter((p) => p.category_id === selectedCategory);
    if (usageFilter) list = list.filter((p) => (p.usage_tags || []).some((u) => u.toLowerCase() === usageFilter.toLowerCase()));
    if (inStockOnly) list = list.filter((p) => p.stock > 0);
    if (selectedBrands.length > 0) list = list.filter((p) => selectedBrands.includes(p.brand));
    if (priceRange[0] > 0 || priceRange[1] > 0) list = list.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);
    if (search) list = filterProducts(list, search, 100);

    const sorted = [...list];
    switch (sortBy) {
      case "popularity": sorted.sort((a, b) => (((b as any).sales_count || 0) * 50 + ((b as any).rating || 0) * ((b as any).review_count || 0) * 8 + (b.is_featured ? 100 : 0)) - (((a as any).sales_count || 0) * 50 + ((a as any).rating || 0) * ((a as any).review_count || 0) * 8 + (a.is_featured ? 100 : 0))); break;
      case "price_asc": sorted.sort((a, b) => a.price - b.price); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price); break;
      case "name": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return sorted;
  }, [allProducts, selectedCategory, usageFilter, inStockOnly, selectedBrands, priceRange, search, sortBy]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [selectedCategory, usageFilter, inStockOnly, selectedBrands.length, priceRange[0], priceRange[1], search, sortBy]);

  const visibleProducts = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  const handleSearchChange = useCallback((q: string) => { setSearch(q); updateURL({ search: q || null }); }, [updateURL]);
  const handleCategoryChange = (cat: Category | null) => { setSelectedCategory(cat?.id || ""); updateURL({ category: cat ? cat.slug || cat.name : null }); };
  const handleSortChange = (value: SortKey) => { setSortBy(value); updateURL({ sort: value === "relevance" ? null : value }); };
  const handleInStockToggle = (value: boolean) => { setInStockOnly(value); updateURL({ in_stock: value ? "true" : null }); };
  const handleUsageToggle = (tag: string) => { const next = usageFilter === tag ? "" : tag; setUsageFilter(next); updateURL({ usage: next || null }); };
  const handleBrandToggle = (brand: string) => { const next = selectedBrands.includes(brand) ? selectedBrands.filter((b) => b !== brand) : [...selectedBrands, brand]; setSelectedBrands(next); updateURL({ brands: next.length > 0 ? next.join(",") : null }); };
  const handlePriceChange = (range: [number, number]) => { setPriceRange(range); updateURL({ min_price: range[0] > priceBounds[0] ? String(range[0]) : null, max_price: range[1] < priceBounds[1] ? String(range[1]) : null }); };
  const resetFilters = () => { setSelectedCategory(""); setInStockOnly(false); setUsageFilter(""); setSelectedBrands([]); setPriceRange(priceBounds); setSearch(""); setSortBy("relevance"); router.replace("/catalog", { scroll: false }); };

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);
  const activeFiltersCount = (selectedCategory ? 1 : 0) + (inStockOnly ? 1 : 0) + (usageFilter ? 1 : 0) + selectedBrands.length + (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1] ? 1 : 0);
  const hasFilters = activeFiltersCount > 0 || !!search;

  const sidebarContent = (
    <FilterSidebar categories={categories} selectedCategory={selectedCategory} onCategoryChange={handleCategoryChange} priceRange={priceRange} priceBounds={priceBounds} onPriceChange={handlePriceChange} selectedBrands={selectedBrands} availableBrands={availableBrands} onBrandToggle={handleBrandToggle} usageTags={USAGE_TAGS} selectedUsage={usageFilter} onUsageToggle={handleUsageToggle} inStockOnly={inStockOnly} onInStockToggle={handleInStockToggle} hasFilters={hasFilters} onReset={resetFilters} />
  );

  return (
    <AnimatedSection className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--fg-muted)]">
            <CpuIcon size={14} /> Catalogue
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="gradient-text">Composants PC & Configurations</span>
          </h1>
        </div>
        <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex items-center gap-2 self-start rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] dark:border-zinc-700 dark:bg-zinc-900 lg:hidden">
          <FilterIcon size={16} /> Filtres
          {activeFiltersCount > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg-accent)] text-[10px] font-bold text-white">{activeFiltersCount}</span>}
        </button>
      </div>

      <div className="mt-6 flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24">{sidebarContent}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <CatalogToolbar products={allProducts} search={search} onSearch={handleSearchChange} sortBy={sortBy} onSortChange={handleSortChange} viewMode={viewMode} onViewChange={setViewMode} totalCount={products.length} />

          {hasFilters && !loading && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedCategoryObj && <FilterChip label={`Catégorie : ${selectedCategoryObj.name}`} onRemove={() => handleCategoryChange(null)} />}
              {usageFilter && <FilterChip label={`Usage : ${usageFilter}`} onRemove={() => handleUsageToggle(usageFilter)} />}
              {selectedBrands.map((brand) => <FilterChip key={brand} label={brand} onRemove={() => handleBrandToggle(brand)} />)}
              {inStockOnly && <FilterChip label="En stock" onRemove={() => handleInStockToggle(false)} />}
              {search && <FilterChip label={`« ${search} »`} onRemove={() => handleSearchChange("")} />}
              <button type="button" onClick={resetFilters} className="ml-1 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">Tout effacer</button>
            </div>
          )}

          <div className="mt-6">
            {loading ? (
              <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "space-y-3"}>
                {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} viewMode={viewMode} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="card py-20 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-muted)]">
                  <CpuIcon size={28} className="text-[var(--fg-muted)]" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[var(--fg-primary)]">Aucun produit trouvé</h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--fg-secondary)]">{search ? `Aucun résultat pour « ${search} ».` : "Essayez d'élargir vos filtres."}</p>
                {hasFilters && <button type="button" onClick={resetFilters} className="btn-primary mt-6 inline-flex">Réinitialiser les filtres</button>}
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {visibleProducts.map((p) => <ProductCard key={p.id} product={p} discounts={discounts} />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleProducts.map((p) => <ProductListItem key={p.id} product={p} discounts={discounts} />)}
                  </div>
                )}
                {hasMore && (
                  <div className="mt-10 flex flex-col items-center gap-3">
                    <button type="button" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="btn-secondary inline-flex items-center gap-2">
                      <ChevronDownIcon size={16} /> Charger {Math.min(PAGE_SIZE, products.length - visibleCount)} produits de plus
                    </button>
                    <p className="text-xs text-[var(--fg-muted)]">{visibleCount} sur {products.length} produits affichés</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--fg-primary)]">Filtres</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="rounded-full p-2 text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]" aria-label="Fermer">
                <XIcon size={20} />
              </button>
            </div>
            {sidebarContent}
            <button type="button" onClick={() => setMobileFiltersOpen(false)} className="btn-primary mt-6 w-full">
              Voir les {products.length} résultat{products.length > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </AnimatedSection>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} className="group inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25">
      {label}
      <XIcon size={12} className="text-blue-600 transition group-hover:text-blue-800 dark:text-blue-400" />
    </button>
  );
}

function ProductSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "list") {
    return (
      <div className="card flex gap-4 p-4">
        <div className="h-32 w-32 shrink-0 animate-pulse rounded-xl bg-[var(--bg-muted)]" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-16 animate-pulse rounded bg-[var(--bg-muted)]" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--bg-muted)]" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-muted)]" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-[var(--bg-muted)]" />
        </div>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="aspect-[4/3] animate-pulse bg-[var(--bg-muted)]" />
      <div className="space-y-3 p-4">
        <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="h-9 w-full animate-pulse rounded-lg bg-[var(--bg-muted)]" />
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-[var(--fg-muted)]">Chargement du catalogue...</div>}>
      <CatalogInner />
    </Suspense>
  );
}
