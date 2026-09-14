"use client";

import { useEffect, useState } from "react";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";

export default function StoreHydrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useCartStore.persist.rehydrate();
    useFavoritesStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  return <>{children}</>;
}
