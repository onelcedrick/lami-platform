"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export default function SidebarSection({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
}: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="py-2">
      {/* Header du groupe */}
      <button
        type="button"
        onClick={() => collapsible && setOpen(!open)}
        disabled={!collapsible}
        className="group flex w-full items-center justify-between px-4 py-1.5 text-left transition-colors disabled:cursor-default"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)] group-hover:text-[var(--fg-secondary)]">
          {title}
        </span>
        {collapsible && (
          <ChevronDownIcon
            size={12}
            className={`text-[var(--fg-muted)] transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        )}
      </button>

      {/* Items */}
      <div
        className={`space-y-0.5 overflow-hidden px-2 transition-all ${
          open ? "mt-1 max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
