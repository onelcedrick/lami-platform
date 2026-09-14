"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnonymousVisit } from "@/lib/analytics";

/**
 * Compte les visiteurs hors login (1 ID anonyme localStorage / navigateur).
 * Declenche a chaque changement de page.
 */
export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Ignore zones admin/tech (peu de sens pour stats public)
    if (
      pathname?.startsWith("/admin") ||
      pathname?.startsWith("/technician")
    ) {
      return;
    }
    trackAnonymousVisit(pathname || "/");
  }, [pathname]);

  return null;
}
