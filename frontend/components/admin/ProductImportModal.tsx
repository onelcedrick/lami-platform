"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";
import {
  downloadErrorsCsv,
  downloadTemplate,
  getValidProducts,
  mapRowsToProducts,
  parseCSV,
  type ImportRow,
} from "@/lib/product-import";
import ImportDropzone from "./import/ImportDropzone";
import ImportPreview from "./import/ImportPreview";
import ImportResult from "./import/ImportResult";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface CategoryLite {
  id: string;
  name: string;
  slug?: string;
}

type Step = "upload" | "preview" | "result";

export default function ProductImportModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [products, setProducts] = useState<ImportRow[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    valid: number;
    errors: number;
    duplicates: number;
    categories: Record<string, number>;
  } | null>(null);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    failed: number;
    errors?: string[];
  } | null>(null);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setProducts([]);
    setStats(null);
    setError("");
    setResult(null);
  };

  // Charge catégories + SKUs existants à l'ouverture
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          api.listCategories(),
          api.listProducts({ limit: 1000 }),
        ]);
        if (catRes.success && catRes.data) {
          setCategories(catRes.data as CategoryLite[]);
        }
        if (prodRes.success && prodRes.data) {
          const skus = new Set<string>(
            (prodRes.data as { sku?: string }[])
              .map((p) => (p.sku || "").toLowerCase())
              .filter(Boolean)
          );
          setExistingSkus(skus);
        }
      } catch {
        /* silent */
      }
    })();
  }, [open]);

  const handleFile = async (file: File) => {
    setError("");
    setResult(null);

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setError(
        "Format Excel natif non supporté. Enregistrez d'abord en CSV (Fichier > Enregistrer sous > CSV)."
      );
      return;
    }

    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      if (rows.length === 0) {
        setError("Fichier vide ou en-têtes manquants");
        return;
      }

      setFileName(file.name);
      const mapped = mapRowsToProducts(rows, categories, existingSkus);
      setProducts(mapped.products);
      setStats(mapped.stats);
      setStep("preview");
    } catch {
      setError("Impossible de lire le fichier");
    }
  };

  const validProducts = useMemo(() => getValidProducts(products), [products]);

  const handleImport = async () => {
    if (validProducts.length === 0) return;
    setImporting(true);
    setError("");

    try {
      const payload = validProducts.map((p) => ({
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        category_id: p.category_id,
        price: p.price,
        stock: p.stock,
        stock_alert: p.stock_alert,
        description: p.description,
        short_description: p.short_description,
        images: p.images,
        tags: p.tags,
        usage_tags: p.usage_tags,
        is_featured: p.is_featured,
        attributes: p.attributes,
      }));

      const res = await api.bulkCreateProducts(payload);
      if (res.success && res.data) {
        const data = res.data as {
          created: number;
          failed: number;
          errors?: string[];
        };
        setResult(data);
        setStep("result");

        void logActivity({
          action: "products_bulk_import",
          category: "admin",
          message: `Import ${data.created} produit(s) depuis ${fileName}`,
          resource: "product",
        });

        if (data.created > 0) onImported();
      } else {
        setError(res.error || "Échec de l'import");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="card w-full max-w-3xl p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              📥 Importer des produits
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {step === "upload" && "Étape 1/3 : Sélectionner le fichier"}
              {step === "preview" &&
                `Étape 2/3 : Prévisualisation — ${fileName}`}
              {step === "result" && "Étape 3/3 : Résultat"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex gap-1">
          {["upload", "preview", "result"].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition ${
                ["upload", "preview", "result"].indexOf(step) >= i
                  ? "bg-primary-500"
                  : "bg-slate-200 dark:bg-slate-800"
              }`}
            />
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* STEP 1 : Upload */}
        {step === "upload" && (
          <div className="mt-6 space-y-4">
            <ImportDropzone onFile={handleFile} />

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pas de fichier prêt ?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Téléchargez le modèle avec 10 exemples
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn-secondary text-xs"
              >
                📄 Modèle CSV
              </button>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
              <p className="font-semibold">💡 Format supporté</p>
              <ul className="mt-1 space-y-0.5">
                <li>• Séparateur auto-détecté : <strong>;</strong> ou <strong>,</strong> ou tabulation</li>
                <li>• Colonnes : nom, sku, marque, categorie, prix, stock, alerte_stock...</li>
                <li>• Les colonnes libres deviennent des <strong>caractéristiques</strong></li>
                <li>• Les catégories inconnues seront créées automatiquement</li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 2 : Preview */}
        {step === "preview" && stats && (
          <div className="mt-6 space-y-4">
            <ImportPreview products={products} stats={stats} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ← Changer de fichier
              </button>

              <div className="flex items-center gap-3">
                {stats.duplicates > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ {stats.duplicates} doublon(s) ignoré(s)
                  </p>
                )}
                <button
                  type="button"
                  disabled={importing || validProducts.length === 0}
                  onClick={handleImport}
                  className="btn-primary disabled:opacity-50"
                >
                  {importing
                    ? "Import en cours..."
                    : `Importer ${validProducts.length} produit(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 : Result */}
        {step === "result" && result && (
          <div className="mt-6">
            <ImportResult
              created={result.created}
              failed={result.failed}
              errors={result.errors}
              onDownloadErrors={
                result.errors && result.errors.length > 0
                  ? () => downloadErrorsCsv(products)
                  : undefined
              }
              onClose={handleClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}