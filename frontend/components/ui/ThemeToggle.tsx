"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/lib/theme-store";

export default function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-lg p-2 text-slate-400"
        aria-label="Theme"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label={theme === "light" ? "Activer le mode nuit" : "Activer le mode jour"}
      title={theme === "light" ? "Mode nuit" : "Mode jour"}
    >
      {theme === "light" ? (
        /* Moon */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 14.3A9 9 0 1 1 9.7 3 7 7 0 0 0 21 14.3z" />
        </svg>
      ) : (
        /* Sun */
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
