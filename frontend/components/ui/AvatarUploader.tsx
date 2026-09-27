"use client";

import { useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface AvatarUploaderProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentUrl?: string | null;
  onUpdated?: (newUrl: string | null) => void; // optionnel
}

export default function AvatarUploader({
  firstName,
  lastName,
  email,
  currentUrl,
  onUpdated,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(currentUrl || null);

  // ✅ Met à jour le store Zustand (Header, UserMenu, etc.)
  const updateAvatarInStore = useAuthStore((s) => s.updateAvatar);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Validation locale
    if (!file.type.startsWith("image/")) {
      setError("Format non supporté (jpg, png, webp)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 2 MB)");
      return;
    }

    // Aperçu local immédiat
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const res = await api.uploadAvatar(file);
      if (res.success && res.data) {
        const data = res.data as { avatar_url: string };
        URL.revokeObjectURL(localUrl);
        setPreview(data.avatar_url);
        // ✅ Propager au store Zustand (le Header se met à jour automatiquement)
        updateAvatarInStore(data.avatar_url);
        onUpdated?.(data.avatar_url);
      } else {
        setError(res.error || "Upload échoué");
        setPreview(currentUrl || null);
        URL.revokeObjectURL(localUrl);
      }
    } catch {
      setError("Erreur réseau");
      setPreview(currentUrl || null);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!preview) return;
    if (!confirm("Supprimer la photo de profil ?")) return;
    setError("");
    setUploading(true);
    try {
      const res = await api.deleteAvatar();
      if (res.success) {
        setPreview(null);
        // ✅ Propager au store Zustand
        updateAvatarInStore(null);
        onUpdated?.(null);
      } else {
        setError(res.error || "Suppression échouée");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      {/* Avatar actuel / preview */}
      <div className="relative">
        <Avatar
          firstName={firstName}
          lastName={lastName}
          email={email}
          imageUrl={preview}
          size="xl"
          ring
        />
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Boutons */}
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {preview ? "Changer la photo" : "Ajouter une photo"}
          </button>

          {preview && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={uploading}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/40"
            >
              Retirer
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          JPG, PNG, WEBP · max 2 MB
        </p>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleSelect}
        />
      </div>
    </div>
  );
}
