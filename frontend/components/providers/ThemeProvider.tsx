"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/lib/theme-store";

/** Applique la classe dark au demarrage (evite flash) */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return <>{children}</>;
}
