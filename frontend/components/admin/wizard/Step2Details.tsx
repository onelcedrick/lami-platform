"use client";

import { formatAriary } from "@/lib/currency";
import ProductAttributesEditor from "@/components/admin/ProductAttributesEditor";

interface Step2DetailsProps {
  form: {
    price: string;
    compare_at_price: string;
    stock: string;
    stock_alert: string;
    short_description: string;
    description: string;
    attributes: Record<string, string>;
    is_featured: boolean;
  };
  onChange: (field: string, value: unknown) => void;
}

export default function Step2Details({ form, onChange }: Step2DetailsProps) {
  const priceNum = Number(form.price) || 0;
  const compareNum = Number(form.compare_at_price) || 0;
  const hasPromo = compareNum > priceNum && priceNum > 0;
  const discountPct = hasPromo
    ? Math.round(((compareNum - priceNum) / compareNum) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--fg-primary)]">
          Détails et tarification
        </h2>
        <p className="mt-1 text-sm text-[var(--fg-secondary)]">
          Complétez avec les prix, stock et descriptions
        </p>
      </div>

      {/* Tarification */}
      <div>
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
              className="input-field"
              value={form.compare_at_price}
              onChange={(e) => onChange("compare_at_price", e.target.value)}
              placeholder="Ancien prix"
            />
            {hasPromo && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                Promo -{discountPct}% (économie {formatAriary(compareNum - priceNum)})
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stock */}
      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Stock
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
              Stock disponible <span className="text-red-500">*</span>
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
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Alerte quand le stock descend sous ce seuil
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="is_featured"
            checked={form.is_featured}
            onChange={(e) => onChange("is_featured", e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-primary-600 focus:ring-primary-500"
          />
          <label
            htmlFor="is_featured"
            className="text-sm text-[var(--fg-secondary)]"
          >
            Mettre en vedette sur la page d'accueil
          </label>
        </div>
      </div>

      {/* Description */}
      <div className="border-t border-[var(--border)] pt-6">
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
          </div>
        </div>
      </div>

      {/* Attributs */}
      <div className="border-t border-[var(--border)] pt-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Attributs techniques
        </h3>
        <ProductAttributesEditor
          attributes={form.attributes}
          onChange={(attrs) => onChange("attributes", attrs)}
        />
      </div>
    </div>
  );
}
