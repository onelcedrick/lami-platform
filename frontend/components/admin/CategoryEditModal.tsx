"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { categoryApi, type CategoryDetail } from "@/lib/api";

interface Props {
  category: CategoryDetail;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

export default function CategoryEditModal({
  category,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description || "");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Bloquer le scroll du body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Fermer avec Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    try {
      const res = await categoryApi.update(category.id, {
        name: name.trim(),
        description: description.trim(),
      });
      if (res.success) {
        onSaved();
      } else {
        onError(res.error || "Erreur lors de la modification");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="card-admin w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-bold text-[var(--fg-primary)]">
            Modifier la catégorie
          </h2>
          <p className="text-xs text-[var(--fg-muted)]">
            ID : <code>{category.id.slice(0, 8)}...</code>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Cartes graphiques"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Le slug sera régénéré automatiquement
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">
              Description
            </label>
            <textarea
              className="input-field min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
