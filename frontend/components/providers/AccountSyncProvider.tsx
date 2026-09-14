
"use client";

import { useEffect, useRef } from "react";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";
import {
  schedulePushCart,
  schedulePushFavorites,
  syncAccountState,
} from "@/lib/sync-account";

export default function AccountSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const cartItems = useCartStore((s) => s.items);
  const favItems = useFavoritesStore((s) => s.items);
  const ready = useRef(false);
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (accessToken && accessToken !== lastToken.current) {
      lastToken.current = accessToken;
      ready.current = false;
      void syncAccountState().finally(() => {
        setTimeout(() => {
          ready.current = true;
        }, 600);
      });
    }
    if (!accessToken) {
      lastToken.current = null;
      ready.current = false;
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !ready.current) return;
    schedulePushCart();
  }, [cartItems, accessToken]);

  useEffect(() => {
    if (!accessToken || !ready.current) return;
    schedulePushFavorites();
  }, [favItems, accessToken]);

  return <>{children}</>;
}
