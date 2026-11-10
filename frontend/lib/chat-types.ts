// frontend/lib/chat-types.ts
// Design Pattern : Context Object
// Contrat de données typé entre l'UI (frontend) et le Backend (IA).

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

export interface ChatRequestPayload {
  message: string;
  conversation_id?: string;
  mode?: string;
  context?: ChatContextPayload;
}
