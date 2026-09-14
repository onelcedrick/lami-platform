"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";
import {
  downloadTemplate,
  mapRowsToProducts,
  parseCSV,
  type ImportRow,
} from "@/lib/product-import";
import { formatAriary } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ProductImportModal({ open, onClose, onImported }: Props) {
  const [fileName, setFileName] = useState("");
  const [products, setProducts] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    failed: number;
    errors?: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setFileName("");
    setProducts([]);
    setParseErrors([]);
    setResult(null);
    setError("");
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setResult(null);
    setError("");
    setFileName(file.name);

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      setError(
        "Format Excel natif non lu ici. Dans Excel : Fichier > Enregistrer sous > CSV (separateur point-virgule) puis reimportez."
      );
      setProducts([]);
      return;
    }

    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      if (rows.length === 0) {
        setError("Fichier vide ou en-tetes manquants");
        setProducts([]);
        return;
      }
      const mapped = mapRowsToProducts(rows);
      setProducts(mapped.products);
      setParseErrors(mapped.errors);
    } catch {
      setError("Impossible de lire le fichier");
    }
  };

  const payload = useMemo(
    () =>
      products.map((p) => ({
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
      })),
    [products]
  );

  const handleImport = async () => {
    if (payload.length === 0) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.bulkCreateProducts(payload);
      if (res.success && res.data) {
        const data = res.data as {
          created: number;
          failed: number;
          errors?: string[];
        };
        setResult(data);
        void logActivity({
          action: "products_bulk_import",
          category: "admin",
          message: `Import ${data.created} produit(s) depuis ${fileName}`,
          resource: "product",
        });
        if (data.created > 0) onImported();
      } else {
        setError(res.error || "Echec de l'import");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="card w-full max-w-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Importer des produits
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              CSV (ou Excel enregistre en CSV) — ecrans, cables, PC, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700"
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="btn-secondary text-sm"
          >
            Telecharger le modele CSV
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/40">
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          {fileName && (
            <p className="mt-2 text-xs text-slate-500">Fichier : {fileName}</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Colonnes reconnues : nom, sku, marque, categorie, prix, stock,
            alerte_stock, description, image, tags, usage, vedette + colonnes
            libres (origine, annee, caracteristiques…) en attributs produit.
            Separateur : <strong>;</strong> ou <strong>,</strong> (auto).
            Categorie = nom existant (ex. Ecrans, CPU).
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="mt-4 max-h-28 overflow-y-auto rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {products.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Apercu ({products.length} valide
              {products.length > 1 ? "s" : ""})
            </p>
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-2 py-2">Ligne</th>
                    <th className="px-2 py-2">Nom</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2">Cat.</th>
                    <th className="px-2 py-2">Prix</th>
                    <th className="px-2 py-2">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.slice(0, 50).map((p) => (
                    <tr key={`${p.sku}-${p._line}`}>
                      <td className="px-2 py-1.5 text-slate-400">{p._line}</td>
                      <td className="px-2 py-1.5 font-medium">{p.name}</td>
                      <td className="px-2 py-1.5">{p.sku}</td>
                      <td className="px-2 py-1.5">{p.category_id}</td>
                      <td className="px-2 py-1.5">{formatAriary(p.price)}</td>
                      <td className="px-2 py-1.5">{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length > 50 && (
                <p className="px-2 py-2 text-xs text-slate-400">
                  … et {products.length - 50} de plus
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            Import termine : <strong>{result.created}</strong> cree(s)
            {result.failed > 0 && (
              <>, <strong>{result.failed}</strong> echec(s)</>
            )}
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-2 max-h-24 list-disc overflow-y-auto pl-4 text-xs">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="btn-secondary"
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={importing || products.length === 0}
            onClick={handleImport}
            className="btn-primary disabled:opacity-50"
          >
            {importing
              ? "Import en cours..."
              : `Importer ${products.length || ""} produit(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
