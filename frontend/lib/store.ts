/**
 * Stores Zustand — L'AMI
 *
 * ⚠️ Tous les stores utilisent `skipHydration: true` pour éviter les
 * erreurs d'hydratation SSR/CSR. La réhydratation est déclenchée côté
 * client par <StoreHydrator /> dans le layout racine.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;

  // Sélecteurs de rôle
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isTechnician: () => boolean;
  isClient: () => boolean;

  // Navigation
  getHomePath: () => string;
}

// ---------------------------------------------------------------------------
// Auth Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => {
        // Duplication dans localStorage pour les fetch directs
        // (SSE, uploads, requêtes hors axios)
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
        }
        set({ user, accessToken, refreshToken });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({ user: null, accessToken: null, refreshToken: null });

        // Nettoyage différé pour éviter les dépendances circulaires
        setTimeout(() => {
          try {
            useCartStore.getState().clear();
            useFavoritesStore.getState().clear();
          } catch {
            /* stores non prêts */
          }
        }, 0);
      },

      // ----- Sélecteurs de rôle -----

      isAuthenticated: () => !!get().accessToken,

      isAdmin: () => {
        const role = get().user?.role;
        return role === "admin" || role === "super_admin";
      },

      isTechnician: () => get().user?.role === "technician",

      isClient: () => {
        const role = get().user?.role;
        return !role || role === "client";
      },

      // ----- Navigation -----

      /**
       * Retourne la route d'accueil selon le rôle.
       * - admin/super_admin → /admin/dashboard
       * - technician        → /technician/dashboard
       * - client (défaut)   → /
       */
      getHomePath: () => {
        const role = get().user?.role;
        if (role === "admin" || role === "super_admin") {
          return "/admin/dashboard";
        }
        if (role === "technician") {
          return "/technician/dashboard";
        }
        return "/";
      },
    }),
    {
      name: "lami-auth",
      skipHydration: true,
    }
  )
);

// ---------------------------------------------------------------------------
// Panier
// ---------------------------------------------------------------------------

export interface CartItem {
  productId: string;
  name: string;
  price: number; // en Ariary
  quantity: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find(
          (i) => i.productId === item.productId
        );
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),

      updateQuantity: (productId, quantity) =>
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }),

      clear: () => set({ items: [] }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      // Nombre de produits distincts (pas la somme des quantités)
      count: () => get().items.length,
    }),
    {
      name: "lami-cart",
      skipHydration: true,
    }
  )
);

// ---------------------------------------------------------------------------
// Favoris
// ---------------------------------------------------------------------------

export interface FavoriteItem {
  productId: string;
  name: string;
  slug?: string;
  brand?: string;
  price: number;
  image?: string;
  stock?: number;
}

interface FavoritesState {
  items: FavoriteItem[];
  toggle: (item: FavoriteItem) => void;
  remove: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  count: () => number;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (item) => {
        const exists = get().items.some(
          (i) => i.productId === item.productId
        );
        if (exists) {
          set({
            items: get().items.filter((i) => i.productId !== item.productId),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),

      isFavorite: (productId) =>
        get().items.some((i) => i.productId === productId),

      count: () => get().items.length,

      clear: () => set({ items: [] }),
    }),
    {
      name: "lami-favorites",
      skipHydration: true,
    }
  )
);
