/**
 * Contrat unique frontend <-> backend IA.
 * `lib/chat-types.ts` re-exporte ce fichier : une seule source de verite.
 */

export type MessageRole = "user" | "assistant" | "system" | "error";

export interface ChatSource {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface ChatToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface ChatProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  stock: number;
  image?: string;
  slug?: string;
  rating?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  mode?: string;
  intent?: string;
  sources?: ChatSource[];
  toolCalls?: ChatToolCall[];
  products?: ChatProduct[];
  cartAdded?: number;
  timestamp: Date;
  status?: "sending" | "sent" | "failed";
  requestId?: string;
}

export type ChatIntent = "general" | "compatibility" | "support" | "commerce";

export interface ChatContextPayload {
  intent: ChatIntent;
  product?: {
    id: string;
    name: string;
    brand: string;
    price: number;
    category?: string;
    attributes?: Record<string, unknown>;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

/** Message tel que persiste par le backend (snake_case, created_at). */
export interface ConversationMessageDTO {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  mode?: string | null;
  sources?: ChatSource[] | null;
  tool_calls?: ChatToolCall[] | null;
  cart_added?: number;
  latency_ms?: number;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  mode: string;
  messages: ConversationMessageDTO[];
  created_at: string;
  last_message_at: string;
}

export interface ChatRequestPayload {
  message: string;
  conversation_id?: string;
  mode?: string;
  context?: ChatContextPayload;
  recent_history?: { role: string; content: string }[];
}

export interface ChatResponsePayload {
  conversation_id: string;
  reply: string;
  mode: string;
  intent?: string;
  sources?: ChatSource[];
  tool_calls?: ChatToolCall[];
  products?: ChatProduct[];
  cart_added?: number;
  latency_ms?: number;
}

export interface ChatHealth {
  status: string;
  documents_count: number;
  llm_provider?: string;
  embedding_model?: string;
}

export interface ChatWidgetConfig {
  welcomeMessage: string;
  quickSuggestions: string[];
  maxMessages: number;
  apiTimeout: number;
}

export const DEFAULT_CHAT_CONFIG: ChatWidgetConfig = {
  welcomeMessage:
    "Bonjour, je suis l'assistant L'AMI.\nJe peux vous aider a :\n" +
    "• **Trouver des composants** PC (CPU, GPU, RAM...)\n" +
    "• **Configurer une machine** selon votre budget\n" +
    "• **Diagnostiquer un probleme** technique\n" +
    "Que recherchez-vous ?",
  quickSuggestions: [
    "PC gaming 3M Ar",
    "Ecran bleu au demarrage",
    "RTX 4070",
    "RAM DDR5 32Go",
  ],
  maxMessages: 100,
  apiTimeout: 25000,
};
