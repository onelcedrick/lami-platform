"use client";

import { useState } from "react";

interface ProductAttributesEditorProps {
  attributes: Record<string, string>;
  onChange: (attrs: Record<string, string>) => void;
}

export default function ProductAttributesEditor({
  attributes,
  onChange,
}: ProductAttributesEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  function addAttribute() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !value) return;
    onChange({ ...attributes, [key]: value });
    setNewKey("");
    setNewValue("");
  }

  function removeAttribute(key: string) {
    const next = { ...attributes };
    delete next[key];
    onChange(next);
  }

  function updateValue(key: string, value: string) {
    onChange({ ...attributes, [key]: value });
  }

  const entries = Object.entries(attributes);

  return (
    <div>
      {/* Liste existante */}
      {entries.length > 0 && (
        <div className="mb-3 space-y-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-2"
            >
              <span className="shrink-0 rounded bg-[var(--bg-surface)] px-2 py-1 text-xs font-medium text-[var(--fg-secondary)]">
                {key}
              </span>
              <input
                className="input-field flex-1 text-sm"
                value={value}
                onChange={(e) => updateValue(key, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeAttribute(key)}
                className="shrink-0 rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Supprimer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ajout */}
      <div className="flex gap-2">
        <input
          className="input-field flex-1 text-sm"
          placeholder="Clé (ex: Socket)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAttribute();
            }
          }}
        />
        <input
          className="input-field flex-1 text-sm"
          placeholder="Valeur (ex: AM5)"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAttribute();
            }
          }}
        />
        <button
          type="button"
          onClick={addAttribute}
          disabled={!newKey.trim() || !newValue.trim()}
          className="btn-secondary shrink-0 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        Exemples : Socket=AM5 · Cores=8 · Fréquence=4.2 GHz · TDP=120W
      </p>
    </div>
  );
}
