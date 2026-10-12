"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { categoryApi, type CategoryDetail } from "@/lib/api";

interface Props {
  category: CategoryDetail & { product_count: number };
  allCategories: Array<CategoryDetail & { product_count: number }>;
  onClose: () => void;
  onDeleted: (moved: number) => void;
  onError: (msg: string) => void;
}

export default function CategoryDeleteModal({
  category,
  allCategories,
  onClose,
  onDeleted,
  onError,
}: Props) {
  const [reassignTo, setReassignTo] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, deleting]);

  const isNonEmpty = category.product_count > 0;
  const others = allCategories.filter((c) => c.id !== category.id);
  const canDelete = !isNonEmpty || reassignTo !== "";
  const confirmOk = confirmText === category.name;

  const handleDelete = async () => {
    if (!confirmOk) {
      onError("Saisissez le nom exact pour confirmer");
      return;
    }
    setDeleting(true);
    try {
      const res = await categoryApi.delete(category.id, reassignTo || undefined);
      if (res.success) {
        const moved =
          (res.data as { products_reassigned?: number })?.products_reassigned ??
          category.product_count;
        onDeleted(moved);
      } else {
        onError(res.error || "Erreur lors de la suppression");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="card-admin w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
            Supprimer la catégorie
          </h2>
          <p className="text-xs text-[var(--fg-muted)]">
            Cette action est irréversible
          </p>
        </div>

        <div className="space-y-4 p-6">
          {/* Warning */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/50 dark:bg-red-950/40">
            <p className="font-semibold text-red-700 dark:text-red-300">
              {category.name}
            </p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {isNonEmpty
                ? `Cette catégorie contient ${category.product_count} produit(s). Vous devez les réaffecter avant de supprimer.`
                : "Cette catégorie est vide et peut être supprimée directement."}
            </p>
          </div>

          {/* Réaffectation si non vide */}
          {isNonEmpty && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                Réaffecter les produits vers{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                required
              >
                <option value="">— Sélectionner une catégorie —</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.product_count} produits)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Confirmation par saisie */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
              Saisissez{" "}
              <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs">
                {category.name}
              </code>{" "}
              pour confirmer
            </label>
            <input
              className="input-field"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={category.name}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={deleting}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !canDelete || !confirmOk}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Suppression..." : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
