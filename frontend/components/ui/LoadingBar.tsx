"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression globale.
 * `useSearchParams` est isole dans une frontiere Suspense : sans elle,
 * le prerender Next echoue sur les pages statiques.
 */
function LoadingBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const activeRequests = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const start = useCallback(() => {
    activeRequests.current += 1;
    if (doneRef.current) {
      clearTimeout(doneRef.current);
      doneRef.current = null;
    }
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    setVisible(true);
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setProgress((prev) =>
        prev >= 90 ? prev : Math.min(90, prev + Math.max(0.5, (90 - prev) / 20))
      );
    }, 200);
  }, []);

  const stop = useCallback(() => {
    activeRequests.current = Math.max(0, activeRequests.current - 1);
    if (activeRequests.current > 0) return;
    if (doneRef.current) clearTimeout(doneRef.current);
    doneRef.current = setTimeout(() => {
      if (activeRequests.current > 0) return;
      clearTick();
      setProgress(100);
      hideRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 150);
  }, []);

  useEffect(() => {
    activeRequests.current = 0;
    clearTick();
    if (doneRef.current) clearTimeout(doneRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    setProgress(0);
    start();
    const timer = setTimeout(() => stop(), 320);
    return () => clearTimeout(timer);
  }, [pathname, query, start, stop]);

  useEffect(() => {
    const onStart = () => start();
    const onStop = () => stop();
    const onLegacy = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      if (detail?.active) start();
      else stop();
    };
    window.addEventListener("loading-bar-start", onStart);
    window.addEventListener("loading-bar-stop", onStop);
    window.addEventListener("loading-bar", onLegacy as EventListener);
    return () => {
      window.removeEventListener("loading-bar-start", onStart);
      window.removeEventListener("loading-bar-stop", onStop);
      window.removeEventListener("loading-bar", onLegacy as EventListener);
      clearTick();
      if (doneRef.current) clearTimeout(doneRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      activeRequests.current = 0;
    };
  }, [start, stop]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 top-0 z-[9999] h-0.5 w-full bg-transparent"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan),0_0_5px_var(--cyan)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}

export default function LoadingBar() {
  return (
    <Suspense fallback={null}>
      <LoadingBarInner />
    </Suspense>
  );
}
