"use client";

import type { ReactNode } from "react";

interface SettingsItemProps {
  label: string;
  description?: string;
  children: ReactNode;
  /** Contrôle à droite (toggle, select, input) */
  align?: "right" | "below";
}

export default function SettingsItem({
  label,
  description,
  children,
  align = "right",
}: SettingsItemProps) {
  if (align === "below") {
    return (
      <div className="px-6 py-4">
        <div className="mb-2">
          <p className="text-sm font-medium text-[var(--fg-primary)]">{label}</p>
          {description && (
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{description}</p>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--fg-primary)]">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
