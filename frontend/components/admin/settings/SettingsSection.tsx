"use client";

import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export default function SettingsSection({
  title,
  description,
  icon,
  children,
}: SettingsSectionProps) {
  return (
    <section className="card-admin overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-[var(--border)] bg-[var(--bg-muted)]/40 px-6 py-4">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[var(--fg-primary)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-[var(--fg-secondary)]">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}
