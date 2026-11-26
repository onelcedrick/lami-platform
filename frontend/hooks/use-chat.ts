"use client";
/**
 * Logique du chatbot - sans JSX.
 * L'ouverture est pilotee par `useChatStore` : le bouton « Demander a l'IA »
 * d'une page produit ouvre reellement le widget et injecte son message.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatAbortError, chatService, newRequestId } from "@/lib/chat/chat-service";
import type {
  ChatMessage,
  ChatProduct,
  ChatRequestPayload,
  ChatToolCall,
  ConversationMessageDTO,
  ConversationSummary,
} from "@/lib/chat/chat-types";
import { DEFAULT_CHAT_CONFIG } from "@/lib/chat/chat-types";
import { useCartStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";

const STORAGE_KEY = "lami-chat-id";

export type ServiceStatus = "unknown" | "online" | "degraded" | "offline";

export interface FailedSend {
  text: string;
  context?: ChatRequestPayload["context"];
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: generateId(),
    role: "assistant",
    content: DEFAULT_CHAT_CONFIG.welcomeMessage,
    timestamp: new Date(),
  };
}

function firstImage(raw: Record<string, unknown>): string | undefined {
  const imgs = raw.images;
  if (Array.isArray(imgs) && typeof imgs[0] === "string" && imgs[0]) return imgs[0];
  if (typeof imgs === "string" && imgs) return imgs;
  return typeof raw.image === "string" && raw.image ? raw.image : undefined;
}

/** Reconstruit les cartes produit depuis les tool_calls persistes. */
function productsFromToolCalls(toolCalls: ChatToolCall[]): ChatProduct[] {
  const out: ChatProduct[] = [];
  const seen = new Set<string>();
  for (const tc of toolCalls) {
    if (!tc.result || typeof tc.result !== "object") continue;
    const data = tc.result as Record<string, unknown>;
    if (data.error) continue;
    let items: unknown[] = [];
    if (Array.isArray(data.build)) items = data.build;
    else if (data.product && typeof data.product === "object") items = [data.product];
    else if (Array.isArray(data.products)) items = data.products;
    else if (Array.isArray(data.items)) items = data.items;
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const p = it as Record<string, unknown>;
      const id = String(p.id ?? p.product_id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: String(p.name ?? "Composant"),
        brand: String(p.brand ?? ""),
        price: Number(p.price) || 0,
        stock: Number(p.stock ?? 0) || 0,
        image: firstImage(p),
        slug: typeof p.slug === "string" ? p.slug : undefined,
        rating: typeof p.rating === "number" ? p.rating : undefined,
      });
    }
  }
  return out;
}

function fromDTO(m: ConversationMessageDTO): ChatMessage {
  const toolCalls = m.tool_calls ?? [];
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    mode: m.mode ?? undefined,
    sources: m.sources ?? [],
    toolCalls,
    products: productsFromToolCalls(toolCalls),
    cartAdded: m.cart_added ?? 0,
    timestamp: new Date(m.created_at),
    status: "sent",
  };
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  conversationId: string | null;
  conversations: ConversationSummary[];
  historyLoading: boolean;
  showHistory: boolean;
  serviceStatus: ServiceStatus;
  lastFailed: FailedSend | null;
  sendMessage: (text: string, context?: ChatRequestPayload["context"]) => Promise<void>;
  retryLast: () => void;
  stopGeneration: () => void;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  startNewConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  toggleHistory: () => void;
  addProductToCart: (product: ChatProduct) => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("unknown");
  const [lastFailed, setLastFailed] = useState<FailedSend | null>(null);

  const isOpen = useChatStore((s) => s.open);
  const storeOpen = useChatStore((s) => s.openChat);
  const storeClose = useChatStore((s) => s.closeChat);
  const addItemToCart = useCartStore((s) => s.addItem);

  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const restoredRef = useRef(false);
  const mountedRef = useRef(true);
  const messagesRef = useRef(messages);
  const conversationIdRef = useRef(conversationId);
  const failedRef = useRef(lastFailed);
  messagesRef.current = messages;
  conversationIdRef.current = conversationId;
  failedRef.current = lastFailed;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const loadConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await chatService.listConversations();
      if (mountedRef.current) setConversations(Array.isArray(data) ? data : []);
    } catch {
      if (mountedRef.current) setConversations([]);
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const id = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!id) return;
    try {
      const detail = await chatService.getConversation(id);
      if (!mountedRef.current) return;
      const loaded = (detail.messages ?? []).map(fromDTO);
      if (loaded.length > 0) {
        setMessages(loaded);
        setConversationId(id);
      }
    } catch {
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await chatService.healthCheck();
      if (!mountedRef.current) return;
      setServiceStatus(
        h.status === "healthy" ? "online" : h.status === "degraded" ? "degraded" : "offline"
      );
    } catch {
      if (mountedRef.current) setServiceStatus("offline");
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string, context?: ChatRequestPayload["context"]) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;
      sendingRef.current = true;
      setLastFailed(null);

      const requestId = newRequestId();
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        status: "sending",
        requestId,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const recentHistory = messagesRef.current
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await chatService.sendMessage(
          {
            message: trimmed,
            conversation_id: conversationIdRef.current ?? undefined,
            mode: "auto",
            context,
            recent_history: recentHistory,
          },
          { requestId, signal: controller.signal }
        );

        if (response.conversation_id) {
          conversationIdRef.current = response.conversation_id;
          setConversationId(response.conversation_id);
          if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, response.conversation_id);
          }
        }

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply || "Desole, une erreur est survenue.",
          mode: response.mode,
          intent: response.intent,
          sources: response.sources ?? [],
          toolCalls: response.tool_calls ?? [],
          products: response.products ?? [],
          cartAdded: response.cart_added ?? 0,
          timestamp: new Date(),
          status: "sent",
        };
        setMessages((prev) =>
          prev
            .map((m) => (m.id === userMessage.id ? { ...m, status: "sent" as const } : m))
            .concat(assistantMessage)
        );

        if ((response.cart_added ?? 0) > 0) {
          for (const tc of response.tool_calls ?? []) {
            if (tc.name !== "add_to_cart" && tc.name !== "add_build_to_cart") continue;
            if (!tc.result || typeof tc.result !== "object") continue;
            const items = (tc.result as Record<string, unknown>).items;
            if (!Array.isArray(items)) continue;
            for (const raw of items) {
              if (!raw || typeof raw !== "object") continue;
              const item = raw as Record<string, unknown>;
              const pid = String(item.product_id ?? item.id ?? "");
              if (!pid) continue;
              addItemToCart({
                productId: pid,
                name: String(item.name ?? "Composant"),
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1,
                image: firstImage(item),
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof ChatAbortError) {
          setMessages((prev) =>
            prev.map((m) => (m.id === userMessage.id ? { ...m, status: "sent" as const } : m))
          );
        } else {
          const content =
            error instanceof Error
              ? error.message
              : "Le service IA est temporairement indisponible. Reessayez dans un instant.";
          setMessages((prev) =>
            prev
              .map((m) => (m.id === userMessage.id ? { ...m, status: "failed" as const } : m))
              .concat({
                id: generateId(),
                role: "error" as const,
                content,
                timestamp: new Date(),
              })
          );
          setLastFailed({ text: trimmed, context });
        }
      } finally {
        sendingRef.current = false;
        abortRef.current = null;
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [addItemToCart]
  );

  const retryLast = useCallback(() => {
    const failed = failedRef.current;
    if (!failed || sendingRef.current) return;
    setMessages((prev) => {
      const next = [...prev];
      while (
        next.length > 0 &&
        (next[next.length - 1].role === "error" || next[next.length - 1].status === "failed")
      ) {
        next.pop();
      }
      return next.length > 0 ? next : [createWelcomeMessage()];
    });
    setLastFailed(null);
    void sendMessage(failed.text, failed.context);
  }, [sendMessage]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const openChat = useCallback(() => {
    storeOpen();
    void restore();
    void refreshHealth();
    void loadConversations();
  }, [storeOpen, restore, refreshHealth, loadConversations]);

  const closeChat = useCallback(() => {
    storeClose();
    setShowHistory(false);
  }, [storeClose]);

  const toggleChat = useCallback(() => {
    if (useChatStore.getState().open) closeChat();
    else openChat();
  }, [closeChat, openChat]);

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    sendingRef.current = false;
    setIsLoading(false);
    setMessages([createWelcomeMessage()]);
    setConversationId(null);
    conversationIdRef.current = null;
    setShowHistory(false);
    setLastFailed(null);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setHistoryLoading(true);
    try {
      const detail = await chatService.getConversation(id);
      const loaded = (detail.messages ?? []).map(fromDTO);
      setMessages(loaded.length > 0 ? loaded : [createWelcomeMessage()]);
      setConversationId(id);
      conversationIdRef.current = id;
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
      setShowHistory(false);
      setLastFailed(null);
    } catch {
      /* historique non critique */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await chatService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationIdRef.current === id) {
        setMessages([createWelcomeMessage()]);
        setConversationId(null);
        conversationIdRef.current = null;
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* silencieux */
    }
  }, []);

  const toggleHistory = useCallback(() => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) void loadConversations();
  }, [showHistory, loadConversations]);

  const addProductToCart = useCallback(
    (product: ChatProduct) => {
      addItemToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      });
    },
    [addItemToCart]
  );

  return {
    messages,
    isLoading,
    isOpen,
    conversationId,
    conversations,
    historyLoading,
    showHistory,
    serviceStatus,
    lastFailed,
    sendMessage,
    retryLast,
    stopGeneration,
    openChat,
    closeChat,
    toggleChat,
    startNewConversation,
    loadConversation,
    deleteConversation,
    toggleHistory,
    addProductToCart,
  };
}
