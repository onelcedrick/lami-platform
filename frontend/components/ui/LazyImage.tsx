"use client";
import { useEffect, useRef, useState } from "react";

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  placeholder?: string;
  fill?: boolean;
  aspectRatio?: string;
  sizes?: string;
  priority?: boolean;
}

const SHIMMER =
  "absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10";

/** Classes statiques : Tailwind JIT ne genere pas les classes interpolees. */
const ASPECT_CLASS: Record<string, string> = {
  "1/1": "aspect-square",
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "3/4": "aspect-[3/4]",
  "21/9": "aspect-[21/9]",
};

const prefetched = new Set<string>();

function prefetchImage(src: string) {
  if (typeof window === "undefined" || !src || prefetched.has(src)) return;
  prefetched.add(src);
  const run = () => {
    const img = new Image();
    img.src = src;
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 0);
}

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

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

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

  const wrapperClass = [
    "relative overflow-hidden bg-slate-100 dark:bg-slate-800",
    aspectRatio ? ASPECT_CLASS[aspectRatio] ?? "" : "",
    fill ? "absolute inset-0" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      onMouseEnter={() => src && prefetchImage(src)}
    >
      {placeholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-lg transition-opacity duration-500 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {!loaded && !placeholder && (
        <div className="absolute inset-0 overflow-hidden bg-slate-200 dark:bg-slate-800">
          <div className={SHIMMER} />
        </div>
      )}

      {inView && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
