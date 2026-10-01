/**
 * Client API pour les routes live du analytics-service.
 * NOTE : les methodes principales sont dans lib/api.ts (liveApi).
 */

import type { ServiceHealth, KPISnapshot } from "./live-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  services?: T;
  error?: string;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    const json: ApiResponse<T> = await res.json();
    if (!json.success) return null;
    return (json.data ?? json.services ?? null) as T | null;
  } catch {
    return null;
  }
}

export const liveApi = {
  kpi: () => get<KPISnapshot>("/api/v1/analytics/kpi"),
  services: () => get<ServiceHealth[]>("/api/v1/analytics/health/services"),
};
