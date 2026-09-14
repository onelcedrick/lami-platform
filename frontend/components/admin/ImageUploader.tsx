"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import LazyImage from "@/components/ui/LazyImage";

interface Props {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  maxSizeMB?: number;
  label?: string;
}

export default function ImageUploader({
  value,
  onChange,
  max = 8,
  maxSizeMB = 5,
  label = "Images du produit",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState("");

  const remaining = max - value.length;

  const pushError = (msg: string) =>
    setError((prev) => (prev ? `${prev}\n${msg}` : msg));

  const upload = useCallback(
    async (files: File[]) => {
      setError("");

      // Validation locale
      const valid: File[] = [];
      const rejected: string[] = [];
      for (const f of files) {
        if (!f.type.startsWith("image/")) {
          rejected.push(`${f.name}: format non supporté`);
          continue;
        }
        if (f.size > maxSizeMB * 1024 * 1024) {
          rejected.push(`${f.name}: dépasse ${maxSizeMB} MB`);
          continue;
        }
        valid.push(f);
      }
      if (rejected.length) pushError(rejected.join("\n"));
      if (!valid.length) return;

      const toUpload = valid.slice(0, remaining);
      if (toUpload.length < valid.length) {
        pushError(
          `${valid.length - toUpload.length} fichier(s) ignoré(s) — limite de ${max} atteinte`
        );
      }
      if (!toUpload.length) return;

      setUploading(true);
      setProgress({ done: 0, total: toUpload.length });

      const newUrls: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        try {
          const res = await api.uploadProductImage(file);
          if (res.success && res.data?.url) {
            newUrls.push(res.data.url);
          } else {
            pushError(`${file.name}: ${res.error || "échec de l'upload"}`);
          }
        } catch {
          pushError(`${file.name}: erreur réseau`);
        }
        setProgress({ done: i + 1, total: toUpload.length });
      }

      if (newUrls.length) {
        onChange([...value, ...newUrls]);
      }
      setUploading(false);
      setProgress(null);
    },
    [value, onChange, remaining, max, maxSizeMB]
  );

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) void upload(files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) void upload(files);
  };

  const removeAt = (i: number) =>
    onChange(value.filter((_, idx) => idx !== i));

  const setAsMain = (i: number) => {
    if (i === 0) return;
    const url = value[i];
    onChange([url, ...value.filter((_, idx) => idx !== i)]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500">
          {label} ({value.length}/{max})
        </label>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-red-600 hover:underline"
          >
            Tout supprimer
          </button>
        )}
      </div>

      {/* Zone de drop */}
      {value.length < max && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition ${
            dragOver
              ? "border-primary-500 bg-primary-50"
              : "border-slate-300 bg-slate-50 hover:border-primary-400"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onSelect}
            className="hidden"
          />
          {uploading && progress ? (
            <p className="text-sm font-medium text-slate-700">
              Upload en cours… ({progress.done}/{progress.total})
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Glissez vos images ici ou cliquez
              </p>
              <p className="mt-1 text-xs text-slate-500">
                JPG, PNG, WEBP, GIF · max {maxSizeMB} MB · jusqu&apos;à{" "}
                {remaining} fichier(s)
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Aperçu */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <LazyImage src={url} alt={`Image ${i + 1}`} fallbackText="?" />

              {i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-primary-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  Principale
                </span>
              )}

              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition group-hover:opacity-100">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => setAsMain(i)}
                    className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-medium text-slate-800 hover:bg-white"
                    title="Définir comme principale"
                  >
                    ★
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-medium text-slate-800 hover:bg-white disabled:opacity-30"
                  title="Déplacer à gauche"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-medium text-slate-800 hover:bg-white disabled:opacity-30"
                  title="Déplacer à droite"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded bg-red-600 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-red-700"
                  title="Supprimer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}