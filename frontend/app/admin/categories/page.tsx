"use client";

import { useCallback, useEffect, useState } from "react";
import { api, categoryApi, type CategoryDetail } from "@/lib/api";
import AnimatedSection from "@/components/ui/AnimatedSection";
import CategoryEditModal from "@/components/admin/CategoryEditModal";
import CategoryDeleteModal from "@/components/admin/CategoryDeleteModal";
import CategoryMergeModal from "@/components/admin/CategoryMergeModal";
import CategoryCreateModal from "@/components/admin/CategoryCreateModal";
import {
  PlusIcon,
  CheckIcon,
  TrashIcon,
  PackageIcon,
} from "@/components/ui/icons";

interface CategoryWithCount extends CategoryDetail {
  product_count: number;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [editTarget, setEditTarget] = useState<CategoryWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);
  const [mergeTarget, setMergeTarget] = useState<CategoryWithCount | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const catRes = await api.listCategories();
      if (!catRes.success || !catRes.data) {
        setError("Impossible de charger les catégories");
        return;
      }
      const cats = catRes.data as CategoryDetail[];

      // Charger les compteurs de produits pour chaque catégorie
      const withCounts = await Promise.all(
        cats.map(async (cat) => {
          try {
            const prodRes = await categoryApi.products(cat.id, 1, 1);
            const total = (prodRes as { meta?: { total?: number } }).meta?.total ?? 0;
            return { ...cat, product_count: total };
          } catch {
            return { ...cat, product_count: 0 };
          }
        })
      );

      // Trier par nom
      withCounts.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(withCounts);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(""), 4000);
    } else {
      setMessage(msg);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const emptyCategories = categories.filter((c) => c.product_count === 0).length;
  const filledCategories = categories.filter((c) => c.product_count > 0).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg-primary)]">
            Catégories
          </h1>
          <p className="mt-1 text-[var(--fg-secondary)]">
            Gérez les catégories de produits · {categories.length} au total
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="btn-primary"
        >
          <PlusIcon size={16} />
          Nouvelle catégorie
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </div>
      )}

      {/* Stats */}
      <AnimatedSection className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card-admin p-5">
          <p className="text-xs font-medium uppercase text-[var(--fg-muted)]">
            Total catégories
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--fg-primary)]">
            {categories.length}
          </p>
        </div>
        <div className="card-admin p-5">
          <p className="text-xs font-medium uppercase text-[var(--fg-muted)]">
            Avec produits
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {filledCategories}
          </p>
        </div>
        <div className="card-admin p-5">
          <p className="text-xs font-medium uppercase text-[var(--fg-muted)]">
            Vides
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {emptyCategories}
          </p>
        </div>
      </AnimatedSection>

      {/* Liste */}
      <div className="mt-6 card-admin overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--fg-muted)]">
            Chargement des catégories...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <PackageIcon size={40} className="mx-auto text-[var(--fg-muted)]" />
            <p className="mt-4 text-[var(--fg-secondary)]">
              Aucune catégorie pour le moment
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                <tr className="text-xs uppercase text-[var(--fg-muted)]">
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 text-center font-medium">Produits</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="transition hover:bg-[var(--bg-muted)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--fg-primary)]">
                          {cat.name}
                        </span>
                        {cat.product_count === 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Vide
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--fg-muted)]">
                          {cat.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs text-[var(--fg-secondary)]">
                        {cat.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          cat.product_count > 0
                            ? "font-semibold text-[var(--fg-primary)]"
                            : "text-[var(--fg-muted)]"
                        }
                      >
                        {cat.product_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(cat)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary-600 transition hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setMergeTarget(cat)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                          title="Fusionner dans une autre catégorie"
                        >
                          Fusionner
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Supprimer"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editTarget && (
        <CategoryEditModal
          category={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            flash("Catégorie modifiée avec succès");
            load();
          }}
          onError={(msg) => flash(msg, true)}
        />
      )}

      {deleteTarget && (
        <CategoryDeleteModal
          category={deleteTarget}
          allCategories={categories}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(moved) => {
            setDeleteTarget(null);
            flash(
              `Catégorie supprimée${moved > 0 ? ` (${moved} produit(s) réaffecté(s))` : ""}`
            );
            load();
          }}
          onError={(msg) => flash(msg, true)}
        />
      )}

      {mergeTarget && (
        <CategoryMergeModal
          category={mergeTarget}
          allCategories={categories}
          onClose={() => setMergeTarget(null)}
          onMerged={(moved) => {
            setMergeTarget(null);
            flash(`Fusion réussie (${moved} produit(s) déplacé(s))`);
            load();
          }}
          onError={(msg) => flash(msg, true)}
        />
      )}

      {createModalOpen && (
        <CategoryCreateModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false);
            flash("Catégorie créée avec succès");
            load();
          }}
          onError={(msg) => flash(msg, true)}
        />
      )}
    </div>
  );
}
