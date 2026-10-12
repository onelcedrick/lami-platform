"use client";

import { useEffect, useState } from "react";
import { formatAriary } from "@/lib/currency";
import ProductImageGrid from "./ProductImageGrid";
import ProductAttributesEditor from "./ProductAttributesEditor";

export interface ProductForm {
  name: string;
  sku: string;
  brand: string;
  category_id: string;
  price: string;
  compare_at_price: string;
  stock: string;
  stock_alert: string;
  short_description: string;
  description: string;
  images: string[];
  attributes: Record<string, string>;
  status: string;
  is_featured: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface ProductEditModalProps {
  open: boolean;
  editing: boolean;
  form: ProductForm;
  categories: Category[];
  error: string;
  onChange: (field: keyof ProductForm, value: unknown) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProductEditModal({
  open,
  editing,
  form,
  categories,
  error,
  onChange,
  onClose,
  onSubmit,
}: ProductEditModalProps) {
  if (!open) return null;

  const priceNum = Number(form.price) || 0;
  const compareNum = Number(form.compare_at_price) || 0;
  const hasPromo = compareNum > priceNum && priceNum > 0;
  const discountPct = hasPromo
    ? Math.round(((compareNum - priceNum) / compareNum) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8">
      <div className="card my-8 w-full max-w-3xl shadow-2xl">
        {/* En-tete */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--fg-primary)]">
              {editing ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <p className="text-xs text-[var(--fg-muted)]">
              {editing ? `SKU : ${form.sku}` : "Remplissez les informations"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
            aria-label="Fermer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6 p-6">
          {/* =====================================================
              SECTION 1 : INFORMATIONS DE BASE
              ===================================================== */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Informations de base
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Nom du produit <span className="text-red-500">*</span>
                </label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  placeholder="ex: AMD Ryzen 7 7800X3D"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  SKU <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    className="input-field font-mono text-sm"
                    value={form.sku}
                    onChange={(e) => onChange("sku", e.target.value)}
                    placeholder="ex: CPU-AMD-7800X3D"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(form.sku);
                    }}
                    className="btn-secondary shrink-0"
                    title="Copier le SKU"
                  >
                    Copier
                  </button>
                </div>
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  Identifiant unique. Format recommandé : CATEGORIE-MARQUE-MODELE
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Marque <span className="text-red-500">*</span>
                </label>
                <input
                  className="input-field"
                  value={form.brand}
                  onChange={(e) => onChange("brand", e.target.value)}
                  placeholder="ex: AMD, Intel, Corsair..."
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                <select
                  className="input-field"
                  value={form.category_id}
                  onChange={(e) => onChange("category_id", e.target.value)}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* =====================================================
              SECTION 2 : TARIFICATION
              ===================================================== */}
          <section className="border-t border-[var(--border)] pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Tarification (Ariary)
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Prix de vente <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input-field"
                  value={form.price}
                  onChange={(e) => onChange("price", e.target.value)}
                  placeholder="ex: 2300000"
                  required
                />
                {priceNum > 0 && (
                  <p className="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400">
                    {formatAriary(priceNum)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Prix barré (optionnel)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input-field"
                  value={form.compare_at_price}
                  onChange={(e) => onChange("compare_at_price", e.target.value)}
                  placeholder="Ancien prix"
                />
                {hasPromo && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    Promo -{discountPct}% (économie{" "}
                    {formatAriary(compareNum - priceNum)})
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* =====================================================
              SECTION 3 : STOCK
              ===================================================== */}
          <section className="border-t border-[var(--border)] pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Stock & statut
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={form.stock}
                  onChange={(e) => onChange("stock", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Seuil d'alerte
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={form.stock_alert}
                  onChange={(e) => onChange("stock_alert", e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Statut
                </label>
                <select
                  className="input-field"
                  value={form.status}
                  onChange={(e) => onChange("status", e.target.value)}
                >
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                id="is_featured"
                checked={form.is_featured}
                onChange={(e) => onChange("is_featured", e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <label htmlFor="is_featured" className="text-sm text-[var(--fg-secondary)]">
                Mettre en vedette sur la page d'accueil
              </label>
            </div>
          </section>

          {/* =====================================================
              SECTION 4 : DESCRIPTION
              ===================================================== */}
          <section className="border-t border-[var(--border)] pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Description
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Description courte (max 200 caractères)
                </label>
                <input
                  className="input-field"
                  value={form.short_description}
                  onChange={(e) => onChange("short_description", e.target.value)}
                  maxLength={200}
                  placeholder="Résumé en 1 phrase pour les cards produit"
                />
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  {form.short_description.length}/200
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
                  Description complète
                </label>
                <textarea
                  className="input-field min-h-[120px]"
                  value={form.description}
                  onChange={(e) => onChange("description", e.target.value)}
                  placeholder="Description détaillée, caractéristiques, compatibilité..."
                />
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  Markdown supporté (**gras**, *italique*, - listes)
                </p>
              </div>
            </div>
          </section>

          {/* =====================================================
              SECTION 5 : IMAGES
              ===================================================== */}
          <section className="border-t border-[var(--border)] pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Photos du produit
            </h3>
            <ProductImageGrid
              images={form.images}
              onChange={(imgs) => onChange("images", imgs)}
              max={8}
            />
          </section>

          {/* =====================================================
              SECTION 6 : ATTRIBUTS
              ===================================================== */}
          <section className="border-t border-[var(--border)] pt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
              Attributs techniques
            </h3>
            <ProductAttributesEditor
              attributes={form.attributes}
              onChange={(attrs) => onChange("attributes", attrs)}
            />
          </section>

          {/* =====================================================
              ACTIONS
              ===================================================== */}
          <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] pt-6">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              {editing ? "Enregistrer les modifications" : "Créer le produit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
