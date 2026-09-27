"use client";

import { formatAriary } from "@/lib/currency";
import type { ImportRow } from "@/lib/product-import";

interface Props {
  products: ImportRow[];
  stats: {
    total: number;
    valid: number;
    errors: number;
    duplicates: number;
    categories: Record<string, number>;
  };
}

export default function ImportPreview({ products, stats }: Props) {
  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total lignes" value={stats.total} tone="slate" />
        <StatCard label="Valides" value={stats.valid} tone="emerald" />
        <StatCard label="Erreurs" value={stats.errors} tone="red" />
        <StatCard label="Doublons" value={stats.duplicates} tone="amber" />
      </div>

      {/* Catégories */}
      {Object.keys(stats.categories).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Répartition par catégorie
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(stats.categories)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <span
                  key={cat}
                  className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200"
                >
                  {cat} <strong>({count})</strong>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-2 py-2 font-medium text-slate-500">#</th>
              <th className="px-2 py-2 font-medium text-slate-500">Nom</th>
              <th className="px-2 py-2 font-medium text-slate-500">SKU</th>
              <th className="px-2 py-2 font-medium text-slate-500">Catégorie</th>
              <th className="px-2 py-2 font-medium text-slate-500">Prix</th>
              <th className="px-2 py-2 font-medium text-slate-500">Stock</th>
              <th className="px-2 py-2 font-medium text-slate-500">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {products.slice(0, 100).map((p) => (
              <tr
                key={p._line}
                className={
                  p._status === "error"
                    ? "bg-red-50/50 dark:bg-red-950/10"
                    : p._status === "duplicate"
                      ? "bg-amber-50/50 dark:bg-amber-950/10"
                      : ""
                }
              >
                <td className="px-2 py-1.5 text-slate-400">{p._line}</td>
                <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-slate-100">
                  {p.name || "—"}
                </td>
                <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                  {p.sku || "—"}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      p.category_resolved
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-amber-700 dark:text-amber-300"
                    }
                  >
                    {p.category_name || "—"}
                    {!p.category_resolved && " (nouvelle)"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                  {p.price > 0 ? formatAriary(p.price) : "—"}
                </td>
                <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                  {p.stock}
                </td>
                <td className="px-2 py-1.5">
                  {p._status === "ok" && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      ✓ OK
                    </span>
                  )}
                  {p._status === "error" && (
                    <span
                      className="inline-flex items-center gap-1 text-red-600 dark:text-red-400"
                      title={p._errors.join(", ")}
                    >
                      ✕ {p._errors[0]}
                    </span>
                  )}
                  {p._status === "duplicate" && (
                    <span
                      className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                      title={p._errors.join(", ")}
                    >
                      ⚠ Doublon
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length > 100 && (
          <p className="px-2 py-2 text-center text-xs text-slate-400">
            … et {products.length - 100} lignes de plus
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "red" | "amber";
}) {
  const colors = {
    slate: "text-slate-700 dark:text-slate-200",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}
