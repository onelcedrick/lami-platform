"use client";

import { useEffect, useState } from "react";
import ProductImageGrid from "@/components/admin/ProductImageGrid";

interface Category {
  id: string;
  name: string;
}

interface Step1InfosProps {
  form: {
    name: string;
    sku: string;
    brand: string;
    category_id: string;
    status: string;
    images: string[];
    usage_tags: string[];
    tags: string[];
  };
  categories: Category[];
  onChange: (field: string, value: unknown) => void;
  skuAuto: boolean;
}

const USAGE_TAGS = [
  { value: "gaming", label: "Gaming" },
  { value: "bureautique", label: "Bureautique" },
  { value: "streaming", label: "Streaming" },
  { value: "creation", label: "Creation contenu" },
  { value: "montage", label: "Montage video" },
  { value: "photo", label: "Photo" },
  { value: "developpement", label: "Developpement" },
  { value: "professionnel", label: "Professionnel" },
];

export default function Step1Infos({
  form,
  categories,
  onChange,
  skuAuto,
}: Step1InfosProps) {
  // Etat local pour le champ tags (evite le split a chaque frappe)
  const [tagsInput, setTagsInput] = useState(form.tags.join(", "));

  // Synchroniser si form.tags change de l'exterieur
  useEffect(() => {
    setTagsInput(form.tags.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTagsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTagsInput(value);
    // On split uniquement sur la virgule (pas a chaque frappe)
    const parsed = value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onChange("tags", parsed);
  }

  function toggleUsageTag(tag: string) {
    const has = form.usage_tags.includes(tag);
    const next = has
      ? form.usage_tags.filter((t) => t !== tag)
      : [...form.usage_tags, tag];
    onChange("usage_tags", next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--fg-primary)]">
          Informations essentielles
        </h2>
        <p className="mt-1 text-sm text-[var(--fg-secondary)]">
          Commencez par les informations de base du produit
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Nom */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
            Nom du produit <span className="text-red-500">*</span>
          </label>
          <input
            className="input-field"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="ex: AMD Ryzen 7 7800X3D"
            autoFocus
            required
          />
        </div>

        {/* SKU */}
        <div>
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
              onClick={() => navigator.clipboard.writeText(form.sku)}
              className="btn-secondary shrink-0"
              title="Copier"
              disabled={!form.sku}
            >
              Copier
            </button>
          </div>
          {skuAuto && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              SKU genere automatiquement (modifiable)
            </p>
          )}
        </div>

        {/* Marque */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
            Marque <span className="text-red-500">*</span>
          </label>
          <input
            className="input-field"
            value={form.brand}
            onChange={(e) => onChange("brand", e.target.value)}
            placeholder="ex: AMD, Intel, Corsair"
            required
          />
        </div>

        {/* Categorie */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
            Categorie <span className="text-red-500">*</span>
          </label>
          <select
            className="input-field"
            value={form.category_id}
            onChange={(e) => onChange("category_id", e.target.value)}
            required
          >
            <option value="">- Selectionner -</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Statut */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
            Statut
          </label>
          <select
            className="input-field"
            value={form.status}
            onChange={(e) => onChange("status", e.target.value)}
          >
            <option value="active">Actif (visible)</option>
            <option value="draft">Brouillon (masque)</option>
            <option value="archived">Archive</option>
          </select>
        </div>
      </div>

      {/* Usage tags */}
      <div className="border-t border-[var(--border)] pt-6">
        <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
          Usage recommande
        </label>
        <p className="mb-3 text-xs text-[var(--fg-muted)]">
          Selectionnez les cas d'usage (visibles dans les filtres du catalogue)
        </p>
        <div className="flex flex-wrap gap-2">
          {USAGE_TAGS.map((tag) => {
            const active = form.usage_tags.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                onClick={() => toggleUsageTag(tag.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                  active
                    ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                    : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--fg-secondary)] hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
        {form.usage_tags.length > 0 && (
          <p className="mt-2 text-xs text-[var(--fg-muted)]">
            {form.usage_tags.length} tag(s) selectionne(s)
          </p>
        )}
      </div>

      {/* Tags libres */}
      <div className="border-t border-[var(--border)] pt-6">
        <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
          Tags personnalises
        </label>
        <input
          className="input-field"
          value={tagsInput}
          onChange={handleTagsChange}
          placeholder="ex: RGB, silencieux, overclockable (separes par virgule)"
        />
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          Mots-cles libres pour la recherche
        </p>
      </div>

      {/* Images */}
      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Photos du produit
        </h3>
        <ProductImageGrid
          images={form.images}
          onChange={(imgs) => onChange("images", imgs)}
          max={8}
        />
      </div>
    </div>
  );
}
