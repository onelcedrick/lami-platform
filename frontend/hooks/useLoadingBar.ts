"use client";
import { useCallback, useState } from "react";

/** Declenche la barre globale (memes evenements que lib/api.ts). */
export function useLoadingBar() {
  const [active, setActive] = useState(false);

  const start = useCallback(() => {
    setActive(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("loading-bar-start"));
    }
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("loading-bar-stop"));
    }
  }, []);

  return { active, start, stop };
}
