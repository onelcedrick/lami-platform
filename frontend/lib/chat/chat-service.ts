/**
 * Couche d'acces API du chat IA.
 * - X-Request-Id : idempotence cote backend (pas de doublon au rejeu)
 * - timeout aligne sur CHAT_TIMEOUT_S du service IA (25 s)
 * - annulation propagee (bouton Arreter / demontage)
 * - erreurs HTTP traduites en messages utilisateur
 */
import type {
  ChatHealth,
  ChatRequestPayload,
  ChatResponsePayload,
  ConversationDetail,
  ConversationSummary,
} from "./chat-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const IA_PREFIX = "/api/v1/ia";
const CHAT_TIMEOUT = 25_000;
const READ_TIMEOUT = 12_000;

export class ChatAbortError extends Error {
  constructor() {
    super("Generation arretee.");
    this.name = "ChatAbortError";
  }
}

export class ChatTimeoutError extends Error {
  constructor() {
    super("Le service IA met trop de temps a repondre. Reessayez.");
    this.name = "ChatTimeoutError";
  }
}

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  let sessionId = localStorage.getItem("lami-ia-session");
  if (!sessionId) {
    sessionId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("lami-ia-session", sessionId);
  }
  return sessionId;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (typeof window !== "undefined") {
    headers["X-Session-Id"] = getSessionId();
    const token = localStorage.getItem("access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function httpMessage(status: number, body: string): string {
  switch (status) {
    case 401:
      return "Connectez-vous pour continuer cette conversation.";
    case 403:
      return "Cette conversation ne vous appartient pas.";
    case 404:
      return "Conversation introuvable ou expiree.";
    case 422:
      return "Message invalide (vide ou trop long).";
    case 429:
      return "Le service IA est tres sollicite. Reessayez dans quelques secondes.";
    default:
      if (status >= 500) return "Le service IA a rencontre une erreur interne.";
      return `Erreur HTTP ${status}${body ? ` : ${body.slice(0, 160)}` : ""}`;
  }
}

interface FetchOptions {
  method?: string;
  body?: string;
  timeout?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeout ?? READ_TIMEOUT);

  const forward = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", forward);
  }

  try {
    const res = await fetch(`${API_BASE}${IA_PREFIX}${path}`, {
      method: opts.method ?? "GET",
      body: opts.body,
      headers: buildHeaders(opts.headers),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(httpMessage(res.status, text));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (error) {
    if (timedOut) throw new ChatTimeoutError();
    if (controller.signal.aborted) throw new ChatAbortError();
    if (error instanceof TypeError) {
      throw new Error("Impossible de contacter le service IA. Verifiez votre connexion.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener("abort", forward);
  }
}

export const chatService = {
  sendMessage(
    payload: ChatRequestPayload,
    opts: { requestId?: string; signal?: AbortSignal } = {}
  ): Promise<ChatResponsePayload> {
    return apiFetch<ChatResponsePayload>("/chat", {
      method: "POST",
      body: JSON.stringify(payload),
      timeout: CHAT_TIMEOUT,
      signal: opts.signal,
      headers: { "X-Request-Id": opts.requestId || newRequestId() },
    });
  },

  listConversations(): Promise<ConversationSummary[]> {
    return apiFetch<ConversationSummary[]>("/conversations");
  },

  getConversation(id: string): Promise<ConversationDetail> {
    return apiFetch<ConversationDetail>(`/conversations/${encodeURIComponent(id)}`);
  },

  async deleteConversation(id: string): Promise<void> {
    await apiFetch(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  renameConversation(id: string, title: string): Promise<unknown> {
    return apiFetch(`/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  healthCheck(): Promise<ChatHealth> {
    return apiFetch<ChatHealth>("/health", { timeout: 8_000 });
  },
};
