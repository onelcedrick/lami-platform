"use client";

import { create } from "zustand";

interface ChatState {
  /** Le chat est-il ouvert ? */
  open: boolean;

  /** Message à pré-remplir automatiquement (optionnel) */
  pendingMessage: string | null;

  /** Ouvre le chat (avec message optionnel) */
  openChat: (message?: string) => void;

  /** Ferme le chat */
  closeChat: () => void;

  /** Bascule ouvert/fermé */
  toggleChat: () => void;

  /** Récupère et efface le message en attente */
  consumePendingMessage: () => string | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  pendingMessage: null,

  openChat: (message) =>
    set({
      open: true,
      pendingMessage: message || null,
    }),

  closeChat: () => set({ open: false }),

  toggleChat: () => set((state) => ({ open: !state.open })),

  consumePendingMessage: () => {
    const msg = get().pendingMessage;
    if (msg) set({ pendingMessage: null });
    return msg;
  },
}));
