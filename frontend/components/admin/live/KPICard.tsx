"use client";

import type { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: "blue" | "green" | "amber" | "red" | "purple";
  subtitle?: string;
}

const ACCENTS: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
  green: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
  red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40",
  purple: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40",
};

export default function KPICard({
  label,
  value,
  icon,
  accent = "blue",
  subtitle,
}: KPICardProps) {
  return (
    <div className="card-admin p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ${ACCENTS[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}
