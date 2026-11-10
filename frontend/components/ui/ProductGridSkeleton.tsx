"use client";

import Skeleton from "./Skeleton";

interface Props {
  count?: number;
  className?: string;
}

/**
 * Skeleton pour une grille de produits.
 * Utilise le composant Skeleton existant.
 */
export default function ProductGridSkeleton({
  count = 8,
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
}: Props) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]"
        >
          <Skeleton variant="rectangular" className="aspect-square rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton variant="text" width="40%" height={10} />
            <Skeleton variant="text" width="80%" height={14} />
            <Skeleton variant="text" width="60%" height={14} />
            <Skeleton variant="text" width="50%" height={20} />
            <Skeleton variant="rectangular" height={40} className="rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
