"use client";

import { useState } from "react";
import { ChevronDownIcon, XIcon } from "@/components/ui/icons";
import PriceRangeSlider from "./PriceRangeSlider";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface FilterSidebarProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (cat: Category | null) => void;

  priceRange: [number, number];
  priceBounds: [number, number];
  onPriceChange: (range: [number, number]) => void;

  selectedBrands: string[];
  availableBrands: { brand: string; count: number }[];
  onBrandToggle: (brand: string) => void;

  usageTags: string[];
  selectedUsage: string;
  onUsageToggle: (tag: string) => void;

  inStockOnly: boolean;
  onInStockToggle: (value: boolean) => void;

  hasFilters: boolean;
  onReset: () => void;
}

export default function FilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  priceRange,
  priceBounds,
  onPriceChange,
  selectedBrands,
  availableBrands,
  onBrandToggle,
  usageTags,
  selectedUsage,
  onUsageToggle,
  inStockOnly,
  onInStockToggle,
  hasFilters,
  onReset,
}: FilterSidebarProps) {
  return (
    <div className="space-y-3">
      {/* Catégories */}
      <Accordion title="Catégories" defaultOpen>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onCategoryChange(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                !selectedCategory
                  ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              Toutes les catégories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onCategoryChange(c)}
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
      </Accordion>

      {/* Prix */}
      <Accordion title="Prix (Ariary)" defaultOpen>
        <PriceRangeSlider
          min={priceBounds[0]}
          max={priceBounds[1]}
          value={priceRange}
          onChange={onPriceChange}
        />
      </Accordion>

      {/* Marques (dynamique) */}
      {availableBrands.length > 0 && (
        <Accordion title="Marques">
          <ul className="space-y-1">
            {availableBrands.map((b) => (
              <li key={b.brand}>
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(b.brand)}
                      onChange={() => onBrandToggle(b.brand)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span>{b.brand}</span>
                  </span>
                  <span className="text-xs text-slate-400">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </Accordion>
      )}

      {/* Usage */}
      <Accordion title="Usage" defaultOpen>
        <div className="flex flex-wrap gap-1.5">
          {usageTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onUsageToggle(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                selectedUsage === tag
                  ? "bg-primary-600 text-white dark:bg-primary-500"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </Accordion>

      {/* Disponibilité */}
      <Accordion title="Disponibilité" defaultOpen>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockToggle(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800"
          />
          En stock uniquement
        </label>
      </Accordion>

      {/* Reset */}
      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <XIcon size={14} />
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accordéon interne
// ---------------------------------------------------------------------------

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/60"
      >
        <span>{title}</span>
        <ChevronDownIcon
          size={16}
          className={`text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-3 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}