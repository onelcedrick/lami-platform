"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression en haut de page (style YouTube/GitHub).
 *
 * Principes :
 * - La progression NE REDESCEND JAMAIS
 * - Se déclenche sur changement de route + fetchs manuels
 * - Ne termine à 100% que quand TOUS les fetchs en cours sont finis
 * - Compteur de fetchs actifs pour ne pas redémarrer entre chaque requête
 */
export default function LoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  // Compteur de requêtes actives (permet de gérer les fetchs parallèles)
  const activeRequests = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Démarre ou continue l'animation
  const startProgress = () => {
    activeRequests.current++;
    setVisible(true);

    // Annuler le timer de complétion si un nouveau fetch arrive
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }

    // Si l'interval tourne déjà, on ne fait rien (la progression continue)
    if (intervalRef.current) return;

    // Sinon, démarrer l'interval
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // Ne jamais redescendre. Ralentit vers 90%.
        if (prev >= 90) return prev;
        const increment = Math.max(0.5, (90 - prev) / 20);
        return Math.min(90, prev + increment);
      });
    }, 200);
  };

  // Arrête l'animation si plus aucune requête active
  const stopProgress = () => {
    activeRequests.current = Math.max(0, activeRequests.current - 1);

    // Si des requêtes sont encore en cours, ne pas terminer
    if (activeRequests.current > 0) return;

    // Attendre un court délai pour voir si un autre fetch arrive
    completeTimerRef.current = setTimeout(() => {
      // Vérifier une dernière fois
      if (activeRequests.current > 0) return;

      // Terminer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setProgress(100);

      // Cacher après la transition
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 150);
  };

  // Reset complet (pour les changements de route)
  const resetAndStart = () => {
    activeRequests.current = 0;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }

    setProgress(0);
    setVisible(true);

    // Démarrer après un micro-délai pour laisser le reset s'appliquer
    requestAnimationFrame(() => {
      startProgress();
    });
  };

  // Déclenchement sur changement de route
  useEffect(() => {
    resetAndStart();

    const timer = setTimeout(() => {
      stopProgress();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (completeTimerRef.current) {
        clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
      activeRequests.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Écoute les événements custom (fetchs manuels)
  useEffect(() => {
    const onStart = () => startProgress();
    const onStop = () => stopProgress();

    window.addEventListener("loading-bar-start", onStart);
    window.addEventListener("loading-bar-stop", onStop);

    return () => {
      window.removeEventListener("loading-bar-start", onStart);
      window.removeEventListener("loading-bar-stop", onStop);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
