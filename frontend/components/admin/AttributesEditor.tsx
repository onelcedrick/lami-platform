"use client";

import { useState } from "react";

interface AttrRow {
  id: string;
  key: string;
  value: string;
}

interface Props {
  value: Record<string, string | number | boolean>;
  onChange: (attrs: Record<string, string | number | boolean>) => void;
  label?: string;
}

let counter = 0;
const uid = () => `attr-${++counter}-${Date.now()}`;

function recordToRows(rec: Record<string, unknown>): AttrRow[] {
  return Object.entries(rec || {}).map(([k, v]) => ({
    id: uid(),
    key: k,
    value: String(v),
  }));
}

/** Tente de convertir "32", "4.8", "true" en types primitifs */
function coerce(v: string): string | number | boolean {
  const t = v.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

function rowsToRecord(rows: AttrRow[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = coerce(r.value);
  }
  return out;
}

export default function AttributesEditor({
  value,
  onChange,
  label = "Caractéristiques techniques",
}: Props) {
  // ⚠️ Le parent doit passer un `key` unique pour forcer un remount
  // quand le produit édité change (voir plus bas).
  const [rows, setRows] = useState<AttrRow[]>(() => recordToRows(value));

  const commit = (next: AttrRow[]) => {
    setRows(next);
    onChange(rowsToRecord(next));
  };

  const setKey = (id: string, k: string) =>
    commit(rows.map((r) => (r.id === id ? { ...r, key: k } : r)));

  const setVal = (id: string, v: string) =>
    commit(rows.map((r) => (r.id === id ? { ...r, value: v } : r)));

  const addRow = () =>
    commit([...rows, { id: uid(), key: "", value: "" }]);

  const remove = (id: string) => commit(rows.filter((r) => r.id !== id));

  const addPreset = (k: string, v: string) =>
    commit([...rows, { id: uid(), key: k, value: v }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          + Ajouter une caractéristique
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          Aucune caractéristique. Ex : <strong>capacity</strong> →{" "}
          <strong>32GB</strong>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input
                type="text"
                className="input-field w-1/3"
                value={r.key}
                onChange={(e) => setKey(r.id, e.target.value)}
                placeholder="Clé (ex: capacity)"
              />
              <input
                type="text"
                className="input-field flex-1"
                value={r.value}
                onChange={(e) => setVal(r.id, e.target.value)}
                placeholder="Valeur (ex: 32GB)"
              />
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50"
                aria-label="Supprimer cette caractéristique"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions rapides selon catégorie */}
      <div className="flex flex-wrap gap-1 pt-1">
        {[
          ["capacity", "32GB"],
          ["speed", "6000MHz"],
          ["socket", "AM5"],
          ["vram", "12GB"],
          ["interface", "PCIe 4.0"],
          ["cores", "8"],
          ["threads", "16"],
        ].map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => addPreset(k, v)}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-primary-50 hover:text-primary-700"
          >
            + {k}
          </button>
        ))}
      </div>
    </div>
  );
}