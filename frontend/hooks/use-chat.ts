/**
 * ============================================================
 * HOOK useChat — Logique métier du chatbot
 * ============================================================
 *
 * RESPONSABILITÉ : gérer tout l'état et la logique du chat.
 * Ce hook est indépendant de l'UI (pas de JSX, pas de DOM).
 *
 * Architecture :
 *   ChatWidget (UI) → useChat (logique) → chatService (API)
 *
 * Ce pattern permet de :
 *  - Tester la logique sans rendre de composant
 *  - Réutiliser le hook dans d'autres contextes (admin, mobile)
 *  - Modifier l'API sans toucher à l'UI
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { chatService } from "@/lib/chat/chat-service";
import type {
  ChatMessage,
  ChatRequestPayload,
  ChatProduct,
  ChatSource,
  ConversationSummary,
} from "@/lib/chat/chat-types";
import { DEFAULT_CHAT_CONFIG } from "@/lib/chat/chat-types";
import { useCartStore, useAuthStore } from "@/lib/store";

// ============================================================
// UTILITAIRES
// ============================================================

/** Génère un identifiant unique pour un message */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Crée le message d'accueil initial */
function createWelcomeMessage(): ChatMessage {
  return {
    id: generateId(),
    role: "assistant",
    content: DEFAULT_CHAT_CONFIG.welcomeMessage,
    timestamp: new Date(),
  };
}

// ============================================================
// INTERFACE DU HOOK
// ============================================================

/** Valeur retournée par le hook useChat */
export interface UseChatReturn {
  /** Liste ordonnée des messages de la conversation */
  messages: ChatMessage[];
  /** true si une réponse IA est en cours de génération */
  isLoading: boolean;
  /** true si le widget de chat est ouvert */
  isOpen: boolean;
  /** ID de la conversation actuelle (null si nouvelle) */
  conversationId: string | null;
  /** Liste des conversations passées (pour l'historique) */
  conversations: ConversationSummary[];
  /** true si l'historique est en cours de chargement */
  historyLoading: boolean;
  /** true si la vue historique est affichée */
  showHistory: boolean;

  // --- Actions ---
  /** Envoie un message utilisateur au chatbot */
  sendMessage: (text: string, context?: ChatRequestPayload["context"]) => Promise<void>;
  /** Ouvre le widget de chat */
  openChat: () => void;
  /** Ferme le widget de chat */
  closeChat: () => void;
  /** Ouvre/ferme le widget */
  toggleChat: () => void;
  /** Démarre une nouvelle conversation (réinitialise) */
  startNewConversation: () => void;
  /** Charge une conversation existante depuis l'historique */
  loadConversation: (id: string) => Promise<void>;
  /** Supprime une conversation */
  deleteConversation: (id: string) => Promise<void>;
  /** Affiche/masque l'historique */
  toggleHistory: () => void;
  /** Ajoute un produit au panier depuis une carte produit du chat */
  addProductToCart: (product: ChatProduct) => void;
}

// ============================================================
// HOOK PRINCIPAL
// ============================================================

export function useChat(): UseChatReturn {
  // ----- État du chat -----
  const [messages, setMessages] = useState<ChatMessage[]>([
    createWelcomeMessage(),
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // ----- Historique -----
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ----- Accès aux stores globaux (panier, auth) -----
  const addItemToCart = useCartStore((s) => s.addItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ----- Référence pour éviter les envois multiples -----
  const isSendingRef = useRef(false);

  // ============================================================
  // ENVOI DE MESSAGE
  // ============================================================

  /**
   * Envoie un message au chatbot et traite la réponse.
   *
   * Flux :
   * 1. Ajouter le message utilisateur à la liste
   * 2. Appeler l'API IA
   * 3. Ajouter la réponse de l'assistant
   * 4. Si des produits ont été ajoutés au panier → synchroniser
   *
   * @param text    - Texte du message utilisateur
   * @param context - Contexte optionnel (produit consulté, etc.)
   */
  const sendMessage = useCallback(
    async (text: string, context?: ChatRequestPayload["context"]) => {
      // Garde-fou : pas de message vide, pas d'envoi concurrent
      const trimmed = text.trim();
      if (!trimmed || isSendingRef.current) return;

      isSendingRef.current = true;

      // Étape 1 : ajouter le message utilisateur à l'affichage
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        status: "sent",
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Étape 2 : construire l'historique récent pour le contexte IA
        // (les 6 derniers messages pour ne pas surcharger le prompt)
        const recentHistory = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        // Étape 3 : appeler le service IA
        const response = await chatService.sendMessage({
          message: trimmed,
          conversation_id: conversationId ?? undefined,
          mode: "auto",
          context,
          recent_history: recentHistory,
        });

        // Étape 4 : stocker l'ID de conversation pour les messages suivants
        if (response.conversation_id) {
          setConversationId(response.conversation_id);
          localStorage.setItem("lami-chat-id", response.conversation_id);
        }

        // Étape 5 : transformer la réponse API en ChatMessage
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.reply || "Désolé, une erreur est survenue.",
          mode: response.mode,
          intent: response.intent,
          sources: response.sources,
          toolCalls: response.tool_calls,
          products: response.products,
          cartAdded: response.cart_added,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Étape 6 : si le backend a ajouté des articles au panier,
        // synchroniser avec le store Zustand
        if (response.cart_added && response.cart_added > 0) {
          const toolCalls = response.tool_calls || [];
          for (const tc of toolCalls) {
            if (
              (tc.name === "add_to_cart" || tc.name === "add_build_to_cart") &&
              tc.result &&
              typeof tc.result === "object" &&
              "items" in (tc.result as Record<string, unknown>)
            ) {
              const items = (tc.result as { items: Array<Record<string, unknown>> }).items;
              for (const item of items) {
                if (item.product_id) {
                  addItemToCart({
                    productId: String(item.product_id),
                    name: String(item.name || "Composant"),
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 1,
                    image: item.image ? String(item.image) : undefined,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // Étape 7 : en cas d'erreur, afficher un message d'erreur
        // plutôt que de laisser le chat silencieux
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "error",
          content:
            error instanceof Error
              ? error.message
              : "Le service IA est temporairement indisponible. Réessayez dans un instant.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        isSendingRef.current = false;
      }
    },
    [messages, conversationId, addItemToCart]
  );

  // ============================================================
  // GESTION DE CONVERSATION
  // ============================================================

  /** Charge la liste des conversations depuis le backend */
  const loadConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await chatService.listConversations();
      setConversations(data);
    } catch {
      // Silencieux : l'historique n'est pas critique
      setConversations([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /** Charge une conversation spécifique et affiche ses messages */
  const loadConversation = useCallback(async (id: string) => {
    setHistoryLoading(true);
    try {
      const detail = await chatService.getConversation(id);
      // Transformer les messages du format backend → ChatMessage
      const loadedMessages: ChatMessage[] = detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        mode: m.mode,
        timestamp: new Date(m.created_at),
      }));
      setMessages(loadedMessages);
      setConversationId(id);
      setShowHistory(false); // Retour à la vue chat
    } catch {
      // Si le chargement échoue, ne pas bloquer
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /** Supprime une conversation */
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await chatService.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Si c'était la conversation active, réinitialiser
      if (conversationId === id) {
        setMessages([createWelcomeMessage()]);
        setConversationId(null);
      }
    } catch {
      // Silencieux
    }
  }, [conversationId]);

  // ============================================================
  // ACTIONS UI
  // ============================================================

  const openChat = useCallback(() => {
    setIsOpen(true);
    // Charger l'historique à l'ouverture
    loadConversations();
  }, [loadConversations]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setShowHistory(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) loadConversations(); // Charger l'historique si on ouvre
      return !prev;
    });
  }, [loadConversations]);

  const startNewConversation = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setConversationId(null);
    setShowHistory(false);
    localStorage.removeItem("lami-chat-id");
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
    if (!showHistory) {
      loadConversations();
    }
  }, [showHistory, loadConversations]);

  /** Ajoute un produit au panier depuis une carte produit du chat */
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

  // ============================================================
  // RETOUR
  // ============================================================

  return {
    messages,
    isLoading,
    isOpen,
    conversationId,
    conversations,
    historyLoading,
    showHistory,
    sendMessage,
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
