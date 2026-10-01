"use client";

import type { ServiceHealth } from "@/lib/live-store";
import { CircleIcon } from "@/components/ui/icons";

const STATUS_COLORS: Record<string, string> = {
  healthy: "text-emerald-500",
  degraded: "text-amber-500",
  down: "text-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  healthy: "Operationnel",
  degraded: "Degrade",
  down: "Hors ligne",
};

export default function ServiceHealthGrid({
  services,
}: {
  services: ServiceHealth[];
}) {
  if (services.length === 0) {
    return (
      <div className="card-admin p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Chargement de l etat des services...
      </div>
    );
  }

  return (
    <div className="card-admin p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Sante des services
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {services.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700/50"
          >
            <CircleIcon
              size={8}
              className={STATUS_COLORS[s.status] || "text-slate-400"}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                {s.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {STATUS_LABELS[s.status] || s.status} - {s.latency_ms} ms
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
