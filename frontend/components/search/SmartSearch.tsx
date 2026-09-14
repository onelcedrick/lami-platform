"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/ui/icons";
import {
  SearchableProduct,
  Suggestion,
  buildSuggestions,
  filterProducts,
} from "@/lib/search";
import { formatAriary } from "@/lib/currency";

interface SmartSearchProps {
  products?: SearchableProduct[];
  placeholder?: string;
  className?: string;
  /** Si true, navigue vers /catalog?search=... */
  navigateOnSubmit?: boolean;
  onSearch?: (query: string) => void;
  onSelectProduct?: (id: string) => void;
  compact?: boolean;
}

export default function SmartSearch({
  products = [],
  placeholder = "Rechercher un produit, marque, SKU...",
  className = "",
  navigateOnSubmit = true,
  onSearch,
  onSelectProduct,
  compact = false,
}: SmartSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [ghost, setGhost] = useState(""); // completion visuelle
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions: Suggestion[] = useMemo(
    () => buildSuggestions(products, query, 8),
    [products, query]
  );

  const previewResults = useMemo(
    () => filterProducts(products, query, 5),
    [products, query]
  );

  useEffect(() => {
    if (suggestions.length > 0 && query.length >= 2) {
      const top = suggestions[0];
      if (top.completion) {
        setGhost(query + top.completion);
      } else {
        setGhost("");
      }
    } else {
      setGhost("");
    }
    setActiveIdx(-1);
  }, [suggestions, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      setQuery(s.label);
      setGhost("");
      setOpen(false);
      if (s.productId && onSelectProduct) {
        onSelectProduct(s.productId);
      }
      if (onSearch) onSearch(s.label);
      if (navigateOnSubmit) {
        router.push(`/catalog?search=${encodeURIComponent(s.label)}`);
      }
    },
    [navigateOnSubmit, onSearch, onSelectProduct, router]
  );

  const submit = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    if (onSearch) onSearch(q);
    if (navigateOnSubmit) {
      router.push(`/catalog?search=${encodeURIComponent(q)}`);
    }
  }, [query, onSearch, navigateOnSubmit, router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" && ghost && ghost !== query) {
      e.preventDefault();
      setQuery(ghost);
      setGhost("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        applySuggestion(suggestions[activeIdx]);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setGhost("");
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        className={`relative flex items-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 ${
          compact ? "px-3 py-1.5" : "px-3.5 py-2.5"
        }`}
      >
        <SearchIcon className="shrink-0 text-slate-400" size={18} />
        <div className="relative ml-2 flex-1">
          {/* Ghost completion (style IDE) */}
          {ghost && open && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 truncate text-sm text-slate-400/70 dark:text-slate-500"
            >
              <span className="invisible">{query}</span>
              <span>{ghost.slice(query.length)}</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (onSearch) onSearch(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="relative w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
          />
        </div>
        {ghost && query && (
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-slate-600 dark:bg-slate-700 sm:inline">
            Tab
          </kbd>
        )}
      </div>

      {open && query.length >= 2 && (suggestions.length > 0 || previewResults.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {suggestions.length > 0 && (
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Suggestions
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${i}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                    i === activeIdx
                      ? "bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>
                    {query}
                    {s.completion && (
                      <span className="font-semibold text-primary-600 dark:text-primary-400">
                        {s.completion}
                      </span>
                    )}
                    {!s.completion && (
                      <span className="font-medium">{s.label}</span>
                    )}
                  </span>
                  {s.brand && (
                    <span className="ml-auto text-xs text-slate-400">{s.brand}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {previewResults.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Produits
              </p>
              {previewResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(p.name);
                    setOpen(false);
                    if (onSelectProduct) onSelectProduct(p.id);
                    if (navigateOnSubmit) {
                      router.push(`/catalog?search=${encodeURIComponent(p.name)}`);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span className="truncate">
                    <span className="font-medium">{p.name}</span>
                    {p.brand && (
                      <span className="ml-2 text-xs text-slate-400">{p.brand}</span>
                    )}
                  </span>
                  {typeof p.price === "number" && (
                    <span className="ml-2 shrink-0 text-xs font-medium text-primary-600 dark:text-primary-400">
                      {formatAriary(p.price)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-primary-600 hover:bg-primary-50 dark:border-slate-800 dark:text-primary-400 dark:hover:bg-primary-900/30"
          >
            Voir tous les resultats pour &quot;{query}&quot;
          </button>
        </div>
      )}
    </div>
  );
}
