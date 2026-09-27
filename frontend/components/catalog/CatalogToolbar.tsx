"use client";

import SmartSearch from "@/components/search/SmartSearch";
import type { SearchableProduct } from "@/lib/search";

export type SortKey =
  | "relevance"
  | "popularity"
  | "price_asc"
  | "price_desc"
  | "name";
export type ViewMode = "grid" | "list";

interface CatalogToolbarProps {
  products: SearchableProduct[];
  search: string;
  onSearch: (q: string) => void;
  sortBy: SortKey;
  onSortChange: (v: SortKey) => void;
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  totalCount: number;
}

const SORT_OPTIONS: { value: SortKey; label: string; icon: string }[] = [
  { value: "relevance", label: "Pertinence", icon: "🎯" },
  { value: "popularity", label: "Popularité", icon: "🔥" },
  { value: "price_asc", label: "Prix croissant", icon: "↑" },
  { value: "price_desc", label: "Prix décroissant", icon: "↓" },
  { value: "name", label: "Nom (A-Z)", icon: "🔤" },
];

export default function CatalogToolbar({
  products,
  search,
  onSearch,
  sortBy,
  onSortChange,
  viewMode,
  onViewChange,
  totalCount,
}: CatalogToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Ligne 1 : Recherche + Tri + Vue */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SmartSearch
            products={products}
            navigateOnSubmit={false}
            onSearch={onSearch}
            placeholder="Rechercher (ryzen, samsung, rtx...)"
          />
        </div>

        {/* Tri */}
        <div className="flex items-center gap-2">
          <label className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
            Trier par
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="input-field w-full text-sm sm:w-44"
            aria-label="Trier par"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.icon} {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle vue (desktop) */}
        <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800 sm:flex">
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
              viewMode === "grid"
                ? "bg-white text-primary-600 shadow-sm dark:bg-slate-900 dark:text-primary-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
            title="Vue grille"
            aria-label="Vue grille"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
              viewMode === "list"
                ? "bg-white text-primary-600 shadow-sm dark:bg-slate-900 dark:text-primary-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
            title="Vue liste"
            aria-label="Vue liste"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Ligne 2 : compteur */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          <strong className="font-semibold text-slate-700 dark:text-slate-200">
            {totalCount}
          </strong>{" "}
          produit{totalCount > 1 ? "s" : ""}
          {search ? ` pour « ${search} »` : ""}
        </span>
      </div>
    </div>
  );
}