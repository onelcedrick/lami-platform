"use client";

import { useEffect, useState } from "react";

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  /** Clé localStorage pour mémoriser l'état ouvert/fermé */
  storageKey?: string;
}

export default function SidebarLayout({
  sidebar,
  children,
  storageKey = "lami-sidebar-open",
}: SidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Charge la préférence depuis localStorage
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setIsOpen(stored === "true");
      }
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(next));
    }
  };

  // Évite le flash côté serveur
  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-60 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 shrink-0 transform border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:overflow-hidden md:border-r-0"
        }`}
      >
        {sidebar}
      </aside>

      {/* Contenu principal */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Toggle button */}
        <button
          type="button"
          onClick={toggle}
          className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label={isOpen ? "Masquer le menu" : "Afficher le menu"}
          title={isOpen ? "Masquer le menu" : "Afficher le menu"}
        >
          {isOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" x2="21" y1="6" y2="6" />
              <line x1="3" x2="21" y1="12" y2="12" />
              <line x1="3" x2="21" y1="18" y2="18" />
            </svg>
          )}
        </button>

        {/* Contenu scrollable */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-6 py-8 pl-16 md:pl-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}