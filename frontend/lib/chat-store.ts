"use client";

import { create } from "zustand";
import { ChatContextPayload } from "./chat-types";

interface ChatState {
  open: boolean;
  pendingMessage: string | null;
  pendingContext: ChatContextPayload | null;

  openChat: (message?: string, context?: ChatContextPayload) => void;
  closeChat: () => void;
  toggleChat: () => void;
  consumePendingData: () => { message: string | null; context: ChatContextPayload | null };
}

export const useChatStore = create<ChatState>((set, get) => ({
  open: false,
  pendingMessage: null,
  pendingContext: null,

  openChat: (message, context) =>
    set({
      open: true,
      pendingMessage: message || null,
      pendingContext: context || null,
    }),

  closeChat: () => set({ open: false }),

  toggleChat: () => set((state) => ({ open: !state.open })),

  consumePendingData: () => {
    const { pendingMessage, pendingContext } = get();
    set({ pendingMessage: null, pendingContext: null });
    return { message: pendingMessage, context: pendingContext };
  },
}));
