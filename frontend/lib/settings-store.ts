"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProductFormMode = "wizard" | "classic";

interface SettingsState {
  // ============================================================
  // Formulaire produit
  // ============================================================
  productFormMode: ProductFormMode;
  skuAutoGenerate: boolean;
  imageCompression: "none" | "low" | "medium" | "high";
  maxProductImages: number;

  // ============================================================
  // Catalogue
  // ============================================================
  productsPerPage: 12 | 24 | 48;
  defaultSort: "relevance" | "price_asc" | "price_desc" | "name";

  // ============================================================
  // Notifications
  // ============================================================
  notifyNewOrder: boolean;
  notifyNewTicket: boolean;
  notifyLowStock: boolean;

  // ============================================================
  // Logo & Branding
  // ============================================================
  /** Logo carre pour la sidebar (base64 ou URL) */
  logoIcon: string | null;
  /** Logo horizontal pour le header (base64 ou URL) */
  logoCompact: string | null;
  /** Logo complet pour login/register (base64 ou URL) */
  logoFull: string | null;

  // ============================================================
  // Actions
  // ============================================================
  setProductFormMode: (mode: ProductFormMode) => void;
  setSkuAutoGenerate: (v: boolean) => void;
  setImageCompression: (v: SettingsState["imageCompression"]) => void;
  setMaxProductImages: (v: number) => void;
  setProductsPerPage: (v: SettingsState["productsPerPage"]) => void;
  setDefaultSort: (v: SettingsState["defaultSort"]) => void;
  setNotifyNewOrder: (v: boolean) => void;
  setNotifyNewTicket: (v: boolean) => void;
  setNotifyLowStock: (v: boolean) => void;

  setLogoIcon: (logo: string | null) => void;
  setLogoCompact: (logo: string | null) => void;
  setLogoFull: (logo: string | null) => void;
  resetLogos: () => void;

  resetAll: () => void;
}

const DEFAULTS = {
  productFormMode: "wizard" as ProductFormMode,
  skuAutoGenerate: true,
  imageCompression: "medium" as const,
  maxProductImages: 8,
  productsPerPage: 24 as const,
  defaultSort: "relevance" as const,
  notifyNewOrder: true,
  notifyNewTicket: true,
  notifyLowStock: true,
  logoIcon: null as string | null,
  logoCompact: null as string | null,
  logoFull: null as string | null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setProductFormMode: (mode) => set({ productFormMode: mode }),
      setSkuAutoGenerate: (v) => set({ skuAutoGenerate: v }),
      setImageCompression: (v) => set({ imageCompression: v }),
      setMaxProductImages: (v) => set({ maxProductImages: v }),
      setProductsPerPage: (v) => set({ productsPerPage: v }),
      setDefaultSort: (v) => set({ defaultSort: v }),
      setNotifyNewOrder: (v) => set({ notifyNewOrder: v }),
      setNotifyNewTicket: (v) => set({ notifyNewTicket: v }),
      setNotifyLowStock: (v) => set({ notifyLowStock: v }),

      setLogoIcon: (logo) => set({ logoIcon: logo }),
      setLogoCompact: (logo) => set({ logoCompact: logo }),
      setLogoFull: (logo) => set({ logoFull: logo }),
      resetLogos: () =>
        set({
          logoIcon: null,
          logoCompact: null,
          logoFull: null,
        }),

      resetAll: () => set(DEFAULTS),
    }),
    {
      name: "lami-settings",
      skipHydration: true,
    }
  )
);
