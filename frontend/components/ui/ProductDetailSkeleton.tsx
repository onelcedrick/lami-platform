"use client";

import Skeleton from "./Skeleton";

/**
 * Skeleton pour la fiche produit (galerie + infos).
 */
export default function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Galerie */}
        <div className="lg:col-span-6">
          <Skeleton variant="rectangular" className="aspect-square rounded-xl" />
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                width={64}
                height={64}
                className="rounded-lg"
              />
            ))}
          </div>
        </div>

        {/* Infos */}
        <div className="space-y-4 lg:col-span-6">
          <Skeleton variant="text" width={80} height={12} />
          <Skeleton variant="text" width="75%" height={32} />
          <Skeleton variant="text" width={150} height={16} />
          <Skeleton variant="text" width={200} height={40} />

          <div className="space-y-2 pt-4">
            <Skeleton variant="text" width="100%" height={12} />
            <Skeleton variant="text" width="85%" height={12} />
            <Skeleton variant="text" width="70%" height={12} />
          </div>

          <Skeleton
            variant="rectangular"
            height={48}
            className="mt-6 rounded-lg"
          />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="mt-8 space-y-4">
        <div className="flex gap-4 border-b border-[var(--border)] pb-2">
          <Skeleton variant="text" width={100} height={20} />
          <Skeleton variant="text" width={100} height={20} />
          <Skeleton variant="text" width={100} height={20} />
        </div>
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="90%" height={14} />
        <Skeleton variant="text" width="75%" height={14} />
      </div>
    </div>
  );
}
