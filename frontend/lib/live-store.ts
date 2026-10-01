import { create } from "zustand";

export interface LiveEvent {
  type: "order" | "visitor" | "ticket" | "ia" | "error" | "activity";
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface ServiceHealth {
  name: string;
  url: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  last_check: string;
  error?: string;
}

export interface KPISnapshot {
  timestamp: string;
  ca_jour_mga: number;
  commandes_jour: number;
  visiteurs_jour: number;
  tickets_ouverts: number;
  panier_moyen_mga: number;
  ia_chats_jour: number;
  ia_latence_p50_ms: number;
}

interface LiveState {
  connected: boolean;
  events: LiveEvent[];
  setConnected: (v: boolean) => void;
  pushEvent: (ev: LiveEvent) => void;
  clearEvents: () => void;
  services: ServiceHealth[];
  setServices: (s: ServiceHealth[]) => void;
  kpi: KPISnapshot | null;
  setKPI: (k: KPISnapshot) => void;
}

const MAX_EVENTS = 200;

export const useLiveStore = create<LiveState>((set) => ({
  connected: false,
  events: [],
  setConnected: (v) => set({ connected: v }),
  pushEvent: (ev) =>
    set((state) => {
      const next = [ev, ...state.events];
      if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
      return { events: next };
    }),
  clearEvents: () => set({ events: [] }),
  services: [],
  setServices: (s) => set({ services: s }),
  kpi: null,
  setKPI: (k) => set({ kpi: k }),
}));
