"use client";

import { useEffect, useRef } from "react";
import type { LiveEvent } from "@/lib/live-store";

const LEVEL_COLORS: Record<string, string> = {
  info: "text-slate-600 dark:text-slate-300",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  info: "bg-slate-50 dark:bg-slate-800/50",
  warn: "bg-amber-50 dark:bg-amber-950/30",
  error: "bg-red-50 dark:bg-red-950/30",
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

export default function LiveFeed({ events }: { events: LiveEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  return (
    <div className="card-admin flex h-[500px] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Flux temps reel
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {events.length} evenement{events.length > 1 ? "s" : ""}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            En attente d evenements...
          </p>
        ) : (
          <ul className="space-y-1">
            {events.map((ev, i) => (
              <li
                key={`${ev.timestamp}-${i}`}
                className={`rounded-md px-3 py-2 text-sm ${LEVEL_BG[ev.level] || LEVEL_BG.info}`}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 font-mono text-xs text-slate-400 dark:text-slate-500">
                    {formatTime(ev.timestamp)}
                  </span>
                  <span className={`flex-1 ${LEVEL_COLORS[ev.level] || ""}`}>
                    {ev.message}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
