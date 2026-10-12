"use client";

import { useRef, useState } from "react";
import { UploadIcon, XIcon, RefreshIcon } from "@/components/ui/icons";
import LamiLogo from "@/components/ui/LamiLogo";

interface LogoUploaderProps {
  label: string;
  description?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  variant: "icon" | "compact" | "full";
  maxSizeMB?: number;
  /** Affiche le logo par defaut en fallback */
  showDefault?: boolean;
}

const ACCEPTED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function LogoUploader({
  label,
  description,
  value,
  onChange,
  variant,
  maxSizeMB = 2,
  showDefault = true,
}: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");

    // Validation type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Format non supporte. Utilisez SVG, PNG, JPG ou WebP.");
      return;
    }

    // Validation taille
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Fichier trop gros (max ${maxSizeMB} Mo)`);
      return;
    }

    setUploading(true);
    try {
      // Conversion en base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setUploading(false);
      };
      reader.onerror = () => {
        setError("Erreur de lecture du fichier");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError("Erreur lors de l'upload");
      setUploading(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleRemove() {
    if (window.confirm("Supprimer ce logo ? Le logo par defaut sera utilise.")) {
      onChange(null);
    }
  }

  // Dimensions du preview selon la variante
  const previewClass =
    variant === "icon"
      ? "h-16 w-16"
      : variant === "compact"
      ? "h-12 w-32"
      : "h-20 w-48";

  return (
    <div className="px-6 py-5">
      {/* Header */}
      <div className="mb-3">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{description}</p>
        )}
      </div>

      {/* Preview + Actions */}
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`flex ${previewClass} shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--bg-muted)] p-2`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={label}
              className="h-full w-full object-contain"
            />
          ) : showDefault ? (
            <LamiLogo variant={variant} size={variant === "full" ? 40 : 32} />
          ) : (
            <span className="text-xs text-[var(--fg-muted)]">Aucun logo</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              <UploadIcon size={14} />
              {value ? "Remplacer" : "Uploader"}
            </button>

            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
              >
                <XIcon size={14} />
                Supprimer
              </button>
            )}
          </div>

          <p className="text-[10px] text-[var(--fg-muted)]">
            SVG, PNG, JPG, WebP - max {maxSizeMB} Mo
          </p>
        </div>
      </div>

      {/* Input cache */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Erreur */}
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
