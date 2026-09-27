"use client";

import { useEffect, useRef, useState } from "react";

interface StatsCounterProps {
  value: string;       // ex: "50+", "24/7", "100%"
  label: string;
  duration?: number;   // ms
}

/**
 * Compteur animé qui se déclenche quand il entre dans le viewport.
 * Gère les valeurs "50+", "24/7", "100%" en extrayant le nombre.
 */
export default function StatsCounter({
  value,
  label,
  duration = 1500,
}: StatsCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayed, setDisplayed] = useState("0");
  const [triggered, setTriggered] = useState(false);

  // Extraire nombre + suffixe/préfixe
  const match = value.match(/^(\d+)(.*)$/);
  const targetNumber = match ? parseInt(match[1], 10) : 0;
  const suffix = match ? match[2] : "";

  useEffect(() => {
    if (!ref.current || triggered) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTriggered(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [triggered]);

  useEffect(() => {
    if (!triggered) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(targetNumber * eased);
      setDisplayed(`${current}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayed(value);
      }
    };
    requestAnimationFrame(tick);
  }, [triggered, targetNumber, suffix, duration, value]);

  return (
    <div ref={ref}>
      <p className="text-2xl font-bold text-white sm:text-3xl tabular-nums">
        {displayed}
      </p>
      <p className="mt-0.5 text-xs text-primary-200 sm:text-sm">{label}</p>
    </div>
  );
}