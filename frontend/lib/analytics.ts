/**
 * Tracking visiteurs anonymes + journal d'activites
 */

const VISITOR_KEY = "lami_visitor_id";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/** Enregistre une visite anonyme (uniquement hors login) */
export async function trackAnonymousVisit(path?: string): Promise<void> {
  if (typeof window === "undefined") return;
  // Ne pas compter les utilisateurs connectes comme visiteurs anonymes
  if (localStorage.getItem("access_token")) return;

  const visitor_id = getVisitorId();
  try {
    await fetch(`${API_BASE}/api/v1/analytics/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitor_id,
        path: path || window.location.pathname,
        referrer: document.referrer || "",
      }),
      // keepalive pour ne pas bloquer la navigation
      keepalive: true,
    });
  } catch {
    // silencieux
  }
}

/** Journalise une activite metier (login, commande, admin...) */
export async function logActivity(payload: {
  action: string;
  category?: string;
  message?: string;
  resource?: string;
  resource_id?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (typeof window === "undefined") return;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = localStorage.getItem("access_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    await fetch(`${API_BASE}/api/v1/analytics/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        path: payload.path || window.location.pathname,
        visitor_id: !token ? getVisitorId() : undefined,
      }),
      keepalive: true,
    });
  } catch {
    // silencieux
  }
}
