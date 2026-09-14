"use client";

import { useEffect, useRef, useState } from "react";

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  /** Miniature floutée (LQIP) affichée pendant le chargement */
  placeholder?: string;
  /** Remplit le parent en position absolute (utile avec aspect-ratio CSS) */
  fill?: boolean;
  /** Ratio d'aspect ("1/1", "16/9"...) — force un wrapper ratio */
  aspectRatio?: string;
  /** Tailles responsives passées au navigateur */
  sizes?: string;
  /** Désactive le lazy loading pour les images above-the-fold */
  priority?: boolean;
}

const SHIMMER =
  "absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10";

export default function LazyImage({
  src,
  alt,
  className = "",
  fallbackText,
  placeholder,
  fill = false,
  aspectRatio,
  sizes,
  priority = false,
}: LazyImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Intersection Observer — charge l'image seulement quand elle approche du viewport
  useEffect(() => {
    if (priority || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [priority]);

  const hasSrc = !!src && !error;
  const showSkeleton = !loaded && hasSrc;

  const wrapperClass = [
    "relative overflow-hidden bg-slate-100 dark:bg-slate-800",
    aspectRatio ? `aspect-[${aspectRatio}]` : "",
    fill ? "absolute inset-0" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // -------- État erreur / pas de src --------
  if (!hasSrc) {
    return (
      <div
        ref={wrapperRef}
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 ${className}`}
      >
        <span className="select-none text-2xl font-bold uppercase tracking-wider text-slate-300 dark:text-slate-600">
          {(fallbackText || alt || "?").slice(0, 8)}
        </span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={wrapperClass}>
      {/* Placeholder LQIP (blur) */}
      {placeholder && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-lg transition-opacity duration-500 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Skeleton shimmer */}
      {showSkeleton && !placeholder && (
        <div className="absolute inset-0 overflow-hidden bg-slate-200 dark:bg-slate-800">
          <div className={SHIMMER} />
        </div>
      )}

      {/* Image réelle */}
      {inView && (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100 animate-fade-in" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}