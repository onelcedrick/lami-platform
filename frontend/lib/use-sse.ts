/**
 * Hook React pour consommer le flux SSE du dashboard admin.
 * Se connecte a /api/v1/analytics/stream via EventSource.
 */

"use client";

import { useEffect, useRef } from "react";
import { useLiveStore, type LiveEvent } from "./live-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useSSE() {
  const pushEvent = useLiveStore((s) => s.pushEvent);
  const setConnected = useLiveStore((s) => s.setConnected);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    // EventSource ne supporte pas les headers personnalises.
    // On passe le token en query param (le backend peut l'accepter).
    const url = new URL(`${API_BASE}/api/v1/analytics/stream`);
    if (token) url.searchParams.set("token", token);

    const es = new EventSource(url.toString(), { withCredentials: false });
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
    });

    const eventTypes = ["order", "visitor", "ticket", "ia", "error", "activity"];
    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const ev = JSON.parse(e.data) as LiveEvent;
          pushEvent(ev);
        } catch {
          // ignore
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
    };

    es.onopen = () => {
      setConnected(true);
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [pushEvent, setConnected]);
}
