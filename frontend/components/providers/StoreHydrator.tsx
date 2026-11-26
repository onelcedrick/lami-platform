"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";
import { useSettingsStore } from "@/lib/settings-store";

/**
 * Tous les stores en `skipHydration: true` doivent etre rehydrates ici,
 * sinon leurs valeurs persistees (logos, preferences admin...) sont perdues.
 */
export default function StoreHydrator({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      useAuthStore.persist.rehydrate(),
      useCartStore.persist.rehydrate(),
      useFavoritesStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]).finally(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) return null;
  return <>{children}</>;
}
