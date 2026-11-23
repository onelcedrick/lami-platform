/**
 * ============================================================
 * SERVICE API CHAT — Couche d'accès aux données
 * ============================================================
 *
 * RESPONSABILITÉ UNIQUE : communiquer avec le backend IA.
 * Ce module ne connaît rien du DOM, de React, ni des composants.
 * Il retourne des données brutes ou lève des erreurs.
 *
 * Avantages :
 *  - Si l'URL du backend change → modifier UN SEUL fichier
 *  - Testable en isolation (mock fetch)
 *  - Réutilisable par d'autres composants (admin, etc.)
 */

import type {
  ChatRequestPayload,
  ChatResponsePayload,
  ConversationDetail,
  ConversationSummary,
} from "./chat-types";

// ============================================================
// CONFIGURATION
// ============================================================

/** URL de base du backend (Gateway ou service IA direct) */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Préfixe des routes IA */
const IA_PREFIX = "/api/v1/ia";

/** Timeout par défaut pour les appels API (60 secondes) */
const DEFAULT_TIMEOUT = 60_000;

// ============================================================
// HELPERS INTERNES
// ============================================================

/**
 * Construit les headers HTTP pour un appel API.
 * Inclut le token d'authentification et l'ID de session anonyme.
 *
 * @returns Objet headers prêt pour fetch
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // ID de session anonyme (pour les visiteurs non connectés)
  // Généré une seule fois et stocké dans localStorage
  if (typeof window !== "undefined") {
    let sessionId = localStorage.getItem("lami-ia-session");
    if (!sessionId) {
      sessionId = `anon-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 11)}`;
      localStorage.setItem("lami-ia-session", sessionId);
    }
    headers["X-Session-Id"] = sessionId;

    // Token JWT si l'utilisateur est connecté
    const token = localStorage.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Effectue un appel fetch avec timeout et gestion d'erreur.
 *
 * @param url     - URL complète de la requête
 * @param options - Options fetch (method, body, etc.)
 * @returns       - Données JSON parsées
 * @throws        - Erreur avec message explicite si échec
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // AbortController pour gérer le timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...buildHeaders(),
        ...options.headers,
      },
      signal: controller.signal,
    });

    // Si le serveur renvoie une erreur HTTP
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Erreur inconnue");
      throw new Error(
        `Erreur HTTP ${response.status} : ${errorText.slice(0, 200)}`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    // Transformation des erreurs réseau en messages explicites
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Le service IA met trop de temps à répondre. Réessayez."
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Impossible de contacter le service IA. Vérifiez votre connexion."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// API PUBLIQUE — Méthodes du service
// ============================================================

/**
 * Service Chat : expose toutes les méthodes pour interagir
 * avec le backend IA. Chaque méthode correspond à un endpoint.
 */
export const chatService = {
  /**
   * Envoie un message au chatbot IA.
   * C'est la méthode principale du chat.
   *
   * @param payload - Message + contexte + conversation
   * @returns       - Réponse de l'IA (reply, sources, produits…)
   */
  async sendMessage(
    payload: ChatRequestPayload
  ): Promise<ChatResponsePayload> {
    return apiFetch<ChatResponsePayload>(
      `${API_BASE}${IA_PREFIX}/chat`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Récupère la liste des conversations de l'utilisateur.
   * Utilisé pour afficher l'historique dans la sidebar.
   */
  async listConversations(): Promise<ConversationSummary[]> {
    return apiFetch<ConversationSummary[]>(
      `${API_BASE}${IA_PREFIX}/conversations`
    );
  },

  /**
   * Récupère le détail d'une conversation (tous les messages).
   * Utilisé quand l'utilisateur clique sur une conversation existante.
   *
   * @param id - ID de la conversation
   */
  async getConversation(id: string): Promise<ConversationDetail> {
    return apiFetch<ConversationDetail>(
      `${API_BASE}${IA_PREFIX}/conversations/${encodeURIComponent(id)}`
    );
  },

  /**
   * Supprime une conversation et tous ses messages.
   *
   * @param id - ID de la conversation à supprimer
   */
  async deleteConversation(id: string): Promise<void> {
    await apiFetch(`${API_BASE}${IA_PREFIX}/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /**
   * Vérifie que le service IA est opérationnel.
   * Utile pour le health check au chargement du widget.
   */
  async healthCheck(): Promise<{
    status: string;
    documents_count: number;
  }> {
    return apiFetch(`${API_BASE}${IA_PREFIX}/health`);
  },
};
