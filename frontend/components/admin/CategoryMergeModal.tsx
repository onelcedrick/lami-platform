"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { categoryApi, type CategoryDetail } from "@/lib/api";

interface Props {
  category: CategoryDetail & { product_count: number };
  allCategories: Array<CategoryDetail & { product_count: number }>;
  onClose: () => void;
  onMerged: (moved: number) => void;
  onError: (msg: string) => void;
}

export default function CategoryMergeModal({
  category,
  allCategories,
  onClose,
  onMerged,
  onError,
}: Props) {
  const [targetId, setTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !merging) onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, merging]);

  const others = allCategories.filter((c) => c.id !== category.id);
  const target = others.find((c) => c.id === targetId);

  const handleMerge = async () => {
    if (!targetId) {
      onError("Sélectionnez une catégorie cible");
      return;
    }
    setMerging(true);
    try {
      const res = await categoryApi.merge(category.id, targetId);
      if (res.success) {
        const moved =
          (res.data as { products_moved?: number })?.products_moved ??
          category.product_count;
        onMerged(moved);
      } else {
        onError(res.error || "Erreur lors de la fusion");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setMerging(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !merging) onClose();
      }}
    >
      <div className="card-admin w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            Fusionner la catégorie
          </h2>
          <p className="text-xs text-[var(--fg-muted)]">
            Déplace les produits puis supprime la source
          </p>
        </div>

        <div className="space-y-4 p-6">
          {/* Source */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3">
            <p className="text-xs uppercase text-[var(--fg-muted)]">Source</p>
            <p className="font-semibold text-[var(--fg-primary)]">
              {category.name}
            </p>
            <p className="text-xs text-[var(--fg-secondary)]">
              {category.product_count} produit(s) seront déplacés
            </p>
          </div>

          {/* Flèche */}
          <div className="text-center text-2xl text-[var(--fg-muted)]">↓</div>

          {/* Cible */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
              Fusionner vers <span className="text-red-500">*</span>
            </label>
            <select
              className="input-field"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              <option value="">— Sélectionner une catégorie —</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.product_count} produits)
                </option>
              ))}
            </select>
            {target && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                Après fusion :{" "}
                <strong>
                  {target.name} ({target.product_count + category.product_count}{" "}
                  produits)
                </strong>
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/40">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              ⚠️ La catégorie source <strong>{category.name}</strong> sera
              supprimée définitivement après la fusion.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={merging}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={merging || !targetId}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {merging ? "Fusion..." : "Fusionner"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
