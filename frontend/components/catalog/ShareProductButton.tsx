"use client";

import { useState } from "react";

interface ShareProductButtonProps {
  productName: string;
  /** Chemin relatif ou URL complete, ex: /product/amd-ryzen-... */
  path: string;
  className?: string;
  compact?: boolean;
}

export default function ShareProductButton({
  productName,
  path,
  className = "",
  compact = false,
}: ShareProductButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared" | "error">(
    "idle"
  );

  const getUrl = () => {
    if (typeof window === "undefined") return path;
    if (path.startsWith("http")) return path;
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  };

  const handleShare = async () => {
    const url = getUrl();
    const title = `${productName} — L'AMI`;
    const text = `Decouvrez ${productName} sur L'AMI (Toamasina)`;

    // Web Share API (mobile / navigateurs supportes)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        setStatus("shared");
        setTimeout(() => setStatus("idle"), 2000);
        return;
      } catch {
        // utilisateur a annule ou non supporte -> fallback copie
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      // Fallback input selection
      try {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
      }
    }
  };

  const label =
    status === "copied"
      ? "Lien copie"
      : status === "shared"
        ? "Partage"
        : status === "error"
          ? "Erreur"
          : compact
            ? "Partager"
            : "Partager le lien";

  return (
    <button
      type="button"
      onClick={handleShare}
      className={
        className ||
        "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      }
      title="Partager ce produit"
      aria-label={`Partager ${productName}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51 15.42 17.49" />
        <path d="M15.41 6.51 8.59 10.49" />
      </svg>
      {!compact && <span>{label}</span>}
      {compact && status !== "idle" && (
        <span className="text-xs text-emerald-600">{label}</span>
      )}
      {!compact && status === "copied" && (
        <span className="text-xs text-emerald-600">OK</span>
      )}
    </button>
  );
}
