"use client";

import { useEffect, useState } from "react";

/**
 * Hook pour declencher la barre de chargement manuellement.
 *
 * Usage :
 *   const { start, stop } = useLoadingBar();
 *   start();
 *   await fetch(...);
 *   stop();
 */
export function useLoadingBar() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Expose un evenement global pour communiquer avec LoadingBar
    if (typeof window === "undefined") return;

    const event = new CustomEvent("loading-bar", {
      detail: { active },
    });
    window.dispatchEvent(event);
  }, [active]);

  return {
    start: () => setActive(true),
    stop: () => setActive(false),
  };
}
