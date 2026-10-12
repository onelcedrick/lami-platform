"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}

export default function CategoryCreateModal({
  onClose,
  onCreated,
  onError,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creating) onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, creating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError("Le nom est obligatoire");
      return;
    }
    setCreating(true);
    try {
      const res = await api.createCategory({
        name: name.trim(),
        description: description.trim(),
      });
      if (res.success) {
        onCreated();
      } else {
        onError(res.error || "Erreur lors de la création");
      }
    } catch {
      onError("Erreur réseau");
    } finally {
      setCreating(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
    >
      <div className="card-admin w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-bold text-[var(--fg-primary)]">
            Nouvelle catégorie
          </h2>
          <p className="text-xs text-[var(--fg-muted)]">
            Créer une nouvelle catégorie de produits
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
              Le slug sera généré automatiquement
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
              disabled={creating}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Création..." : "Créer la catégorie"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
