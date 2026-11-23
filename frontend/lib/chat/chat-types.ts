/**
 * ============================================================
 * TYPES DU DOMAINE CHAT — L'AMI
 * ============================================================
 *
 * Définit toutes les interfaces utilisées par le chatbot.
 * Ces types sont le "contrat" entre le frontend et le backend.
 *
 * Principe Clean Architecture : les types sont indépendants
 * de tout framework UI ou de toute implémentation.
 */

// ============================================================
// 1. MESSAGES
// ============================================================

/** Rôle d'un message dans la conversation */
export type MessageRole = "user" | "assistant" | "system" | "error";

/** Source RAG renvoyée par le backend (document de connaissance) */
export interface ChatSource {
  /** Identifiant unique du document */
  id: string;
  /** Titre du document (ex: "Ecran bleu (BSOD) - Diagnostic de base") */
  title: string;
  /** Extrait du contenu pertinent */
  content: string;
  /** Score de pertinence (0 à 1) — plus c'est proche de 1, mieux c'est */
  score: number;
  /** Métadonnées supplémentaires (catégorie, tags…) */
  metadata?: Record<string, unknown>;
}

/** Résultat d'un appel d'outil (Function Calling) */
export interface ChatToolCall {
  /** Nom de l'outil appelé (ex: "search_products", "suggest_pc_build") */
  name: string;
  /** Arguments passés à l'outil */
  arguments: Record<string, unknown>;
  /** Résultat renvoyé par l'outil (peut être un objet, une liste, etc.) */
  result: unknown;
}

/** Carte produit renvoyée dans la réponse du chat */
export interface ChatProduct {
  id: string;
  name: string;
  brand: string;
  /** Prix en Ariary (MGA) */
  price: number;
  /** Quantité en stock */
  stock: number;
  /** URL de l'image (peut être relative ou absolue) */
  image?: string;
  /** Slug pour construire l'URL de la page produit */
  slug?: string;
  /** Note moyenne (0 à 5) */
  rating?: number;
}

/** Un message de la conversation */
export interface ChatMessage {
  /** Identifiant unique du message */
  id: string;
  /** Rôle : qui a écrit ce message */
  role: MessageRole;
  /** Contenu textuel (peut contenir du Markdown) */
  content: string;
  /** Mode détecté par l'IA (support, commerce, general…) */
  mode?: string;
  /** Intent détecté par le NLU (diagnostic, produit, configuration…) */
  intent?: string;
  /** Sources RAG utilisées pour générer la réponse */
  sources?: ChatSource[];
  /** Outils appelés pendant le traitement */
  toolCalls?: ChatToolCall[];
  /** Produits trouvés (pour le mode commerce) */
  products?: ChatProduct[];
  /** Nombre d'articles ajoutés au panier */
  cartAdded?: number;
  /** Horodatage du message */
  timestamp: Date;
  /** Statut d'envoi (pour les messages utilisateur) */
  status?: "sending" | "sent" | "failed";
}

// ============================================================
// 2. CONVERSATION
// ============================================================

/** Résumé d'une conversation (pour la liste dans la sidebar) */
export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

/** Détail complet d'une conversation (avec messages) */
export interface ConversationDetail {
  id: string;
  title: string;
  mode: string;
  messages: ChatMessage[];
  created_at: string;
  last_message_at: string;
}

// ============================================================
// 3. REQUÊTE / RÉPONSE API
// ============================================================

/** Corps de la requête POST /api/v1/ia/chat */
export interface ChatRequestPayload {
  /** Message texte de l'utilisateur */
  message: string;
  /** ID de conversation existante (pour continuer une discussion) */
  conversation_id?: string;
  /** Mode forcé : "auto" | "support" | "commerce" | "general" */
  mode?: string;
  /** Contexte produit (si l'utilisateur est sur une page produit) */
  context?: {
    intent: string;
    product?: {
      id: string;
      name: string;
      brand: string;
      price: number;
      category?: string;
      attributes?: Record<string, unknown>;
    };
  };
  /** Historique récent (optionnel, envoyé par le frontend) */
  recent_history?: { role: string; content: string }[];
}

/** Réponse du backend POST /api/v1/ia/chat */
export interface ChatResponsePayload {
  /** ID de la conversation (à stocker pour les messages suivants) */
  conversation_id: string;
  /** Réponse texte de l'IA (peut contenir du Markdown) */
  reply: string;
  /** Mode détecté : "support" | "commerce" | "general" | … */
  mode: string;
  /** Intent NLU : "diagnostic" | "produit" | "configuration" | … */
  intent?: string;
  /** Documents sources utilisés par le RAG */
  sources?: ChatSource[];
  /** Appels d'outils effectués */
  tool_calls?: ChatToolCall[];
  /** Produits trouvés dans le catalogue */
  products?: ChatProduct[];
  /** Nombre d'articles ajoutés au panier */
  cart_added?: number;
  /** Latence de traitement en millisecondes */
  latency_ms?: number;
}

// ============================================================
// 4. CONFIGURATION DU WIDGET
// ============================================================

/** Options de configuration du widget de chat */
export interface ChatWidgetConfig {
  /** Message d'accueil affiché au premier lancement */
  welcomeMessage: string;
  /** Suggestions rapides affichées sous l'input */
  quickSuggestions: string[];
  /** Nombre maximum de messages dans l'historique */
  maxMessages: number;
  /** Timeout pour les appels API (en ms) */
  apiTimeout: number;
}

/** Configuration par défaut du widget */
export const DEFAULT_CHAT_CONFIG: ChatWidgetConfig = {
  welcomeMessage:
    "Bonjour, je suis l'assistant L'AMI.\n\nJe peux vous aider à :\n" +
    "• **Trouver des composants** PC (CPU, GPU, RAM…)\n" +
    "• **Configurer une machine** selon votre budget\n" +
    "• **Diagnostiquer un problème** technique\n\n" +
    "Que recherchez-vous ?",
  quickSuggestions: [
    "PC gaming 3M Ar",
    "Écran bleu au démarrage",
    "RTX 4070",
    "RAM DDR5 32Go",
  ],
  maxMessages: 100,
  apiTimeout: 60000,
};
