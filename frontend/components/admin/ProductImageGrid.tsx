"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import LazyImage from "@/components/ui/LazyImage";
import { UploadIcon, XIcon, StarIcon } from "@/components/ui/icons";

interface ProductImageGridProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}

export default function ProductImageGrid({
  images,
  onChange,
  max = 8,
}: ProductImageGridProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setError("");

    const remaining = max - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${max} images atteint`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploading(true);
    setProgress({ done: 0, total: toUpload.length });

    try {
      const uploaded: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];

        if (file.size > 5 * 1024 * 1024) {
          setError(`"${file.name}" depasse 5 Mo`);
          continue;
        }
        if (!file.type.startsWith("image/")) {
          setError(`"${file.name}" n'est pas une image`);
          continue;
        }

        const res = await api.uploadProductImage(file);
        if (res.success && res.data) {
          uploaded.push((res.data as { url: string }).url);
        } else {
          setError(res.error || `Erreur upload "${file.name}"`);
        }

        setProgress({ done: i + 1, total: toUpload.length });
      }

      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
      }
    } catch {
      setError("Erreur reseau lors de l'upload");
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ===== Drag & drop handlers (sur le wrapper complet) =====
  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragActive(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      uploadFiles(files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(Array.from(e.target.files));
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function setAsMain(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [img] = next.splice(index, 1);
    next.unshift(img);
    onChange(next);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Zone de drop */}
      {images.length < max && (
        <label
          className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            dragActive
              ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40"
              : "border-[var(--border)] hover:border-primary-400 hover:bg-[var(--bg-muted)]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileInput}
            disabled={uploading}
          />

          {uploading && progress ? (
            <>
              <p className="text-sm font-medium text-[var(--fg-primary)]">
                Upload en cours...
              </p>
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                {progress.done} / {progress.total} fichier(s)
              </p>
              <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <UploadIcon size={40} className="text-[var(--fg-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--fg-primary)]">
                Glissez vos images ici ou cliquez pour parcourir
              </p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">
                JPG, PNG, WEBP - max 5 Mo - jusqu&apos;a {max - images.length} fichier(s)
              </p>
            </>
          )}
        </label>
      )}

      {/* Grille */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]"
            >
              <LazyImage src={src} alt={`Image ${i + 1}`} fill />

              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  PRINCIPALE
                </span>
              )}

              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => setAsMain(i)}
                    className="rounded-full bg-white/90 p-1.5 text-slate-700 transition hover:bg-white"
                    title="Definir comme principale"
                  >
                    <StarIcon size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded-full bg-red-500 p-1.5 text-white transition hover:bg-red-600"
                  title="Supprimer"
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[var(--fg-muted)]">
          {images.length} / {max} images
        </span>
        {images.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-red-600 hover:underline"
          >
            Tout supprimer
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
