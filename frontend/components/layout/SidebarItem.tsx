"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number | string;
  badgeColor?: "default" | "warning" | "danger";
  exact?: boolean;
}

export default function SidebarItem({
  href,
  label,
  icon,
  badge,
  badgeColor = "default",
  exact = false,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  const badgeClasses = {
    default:
      "bg-[var(--bg-muted)] text-[var(--fg-secondary)] border border-[var(--border)]",
    warning:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
    danger:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
  };

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        isActive
          ? "bg-primary-500 text-white shadow-sm"
          : "text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
      }`}
    >
      {/* Icône */}
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center transition-transform group-hover:scale-110 ${
          isActive ? "text-white" : "text-[var(--fg-muted)] group-hover:text-primary-500"
        }`}
      >
        {icon}
      </span>

      {/* Label */}
      <span className="flex-1 truncate">{label}</span>

      {/* Badge */}
      {badge !== undefined && badge !== 0 && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isActive
              ? "bg-white/20 text-white"
              : badgeClasses[badgeColor]
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
