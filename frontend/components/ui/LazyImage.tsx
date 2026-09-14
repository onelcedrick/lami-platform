"use client";

import { useState } from "react";

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

/** Image avec lazy loading natif + fallback texte (marque) */
export default function LazyImage({
  src,
  alt,
  className = "",
  fallbackText,
}: LazyImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}
      >
        <span className="text-3xl font-bold uppercase tracking-wider text-slate-300 dark:text-slate-600">
          {(fallbackText || alt || "?").slice(0, 8)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
      className={`h-full w-full object-contain ${className}`}
    />
  );
}
