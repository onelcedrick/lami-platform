"use client";

import { useState } from "react";
import { ChevronDownIcon, XIcon } from "@/components/ui/icons";
import PriceRangeSlider from "./PriceRangeSlider";

interface Category { id: string; name: string; slug: string; }

interface FilterSidebarProps {
  categories: Category[]; selectedCategory: string; onCategoryChange: (cat: Category | null) => void;
  priceRange: [number, number]; priceBounds: [number, number]; onPriceChange: (range: [number, number]) => void;
  selectedBrands: string[]; availableBrands: { brand: string; count: number }[]; onBrandToggle: (brand: string) => void;
  usageTags: string[]; selectedUsage: string; onUsageToggle: (tag: string) => void;
  inStockOnly: boolean; onInStockToggle: (value: boolean) => void;
  hasFilters: boolean; onReset: () => void;
}

export default function FilterSidebar({
  categories, selectedCategory, onCategoryChange, priceRange, priceBounds, onPriceChange,
  selectedBrands, availableBrands, onBrandToggle, usageTags, selectedUsage, onUsageToggle,
  inStockOnly, onInStockToggle, hasFilters, onReset,
}: FilterSidebarProps) {
  return (
    <div className="space-y-3">
      <Accordion title="Catégories" defaultOpen>
        <ul className="space-y-0.5">
          <li>
            <button type="button" onClick={() => onCategoryChange(null)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${!selectedCategory ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)]"}`}>
              Toutes les catégories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onCategoryChange(c)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${selectedCategory === c.id ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)]"}`}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </Accordion>

      <Accordion title="Prix (Ariary)" defaultOpen>
        <PriceRangeSlider min={priceBounds[0]} max={priceBounds[1]} value={priceRange} onChange={onPriceChange} />
      </Accordion>

      {availableBrands.length > 0 && (
        <Accordion title="Marques">
          <ul className="space-y-1">
            {availableBrands.map((b) => (
              <li key={b.brand}>
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)]">
                  <span className="flex items-center gap-2.5">
                    <input type="checkbox" checked={selectedBrands.includes(b.brand)} onChange={() => onBrandToggle(b.brand)} className="h-4 w-4 rounded border-[var(--border-strong)] text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800" />
                    <span className="text-[var(--fg-primary)]">{b.brand}</span>
                  </span>
                  <span className="text-xs text-[var(--fg-muted)]">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </Accordion>
      )}

      <Accordion title="Usage" defaultOpen>
        <div className="flex flex-wrap gap-1.5">
          {usageTags.map((tag) => (
            <button key={tag} type="button" onClick={() => onUsageToggle(tag)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${selectedUsage === tag ? "bg-blue-600 text-white dark:bg-blue-500" : "bg-[var(--bg-muted)] text-[var(--fg-secondary)] hover:bg-[var(--border-strong)]"}`}>
              {tag}
            </button>
          ))}
        </div>
      </Accordion>

      <Accordion title="Disponibilité" defaultOpen>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--fg-secondary)]">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => onInStockToggle(e.target.checked)} className="h-4 w-4 rounded border-[var(--border-strong)] text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800" />
          <span className="text-[var(--fg-primary)]">En stock uniquement</span>
        </label>
      </Accordion>

      {hasFilters && (
        <button type="button" onClick={onReset} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-sm font-medium text-[var(--fg-secondary)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400">
          <XIcon size={14} /> Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] transition-all dark:border-zinc-800 dark:bg-zinc-900">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--fg-primary)] transition hover:bg-[var(--bg-muted)]">
        <span>{title}</span>
        <ChevronDownIcon size={16} className={`text-[var(--fg-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-3 pb-3 pt-3 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
