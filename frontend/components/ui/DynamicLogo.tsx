"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/lib/settings-store";
import LamiLogo from "./LamiLogo";

interface DynamicLogoProps {
  variant: "icon" | "compact" | "full";
  size?: number;
  className?: string;
}

/**
 * Affiche le logo custom (si uploadé dans les parametres)
 * OU le logo SVG L'AMI par defaut.
 *
 * Gere le skipHydration de Zustand : retourne le fallback
 * tant que le store n'est pas hydrate.
 */
export default function DynamicLogo({
  variant,
  size = 40,
  className = "",
}: DynamicLogoProps) {
  const [mounted, setMounted] = useState(false);

  // Recuperer les logos du store
  const logoIcon = useSettingsStore((s) => s.logoIcon);
  const logoCompact = useSettingsStore((s) => s.logoCompact);
  const logoFull = useSettingsStore((s) => s.logoFull);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avant hydratation : afficher le fallback
  if (!mounted) {
    return <LamiLogo variant={variant} size={size} className={className} />;
  }

  // Choisir le logo selon la variante
  const customLogo =
    variant === "icon"
      ? logoIcon
      : variant === "compact"
      ? logoCompact
      : logoFull;

  // Si logo custom, l'afficher
  if (customLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={customLogo}
        alt="L'AMI"
        className={`object-contain ${className}`}
        style={{
          height: variant === "icon" ? size : undefined,
          maxHeight: size * 2,
        }}
      />
    );
  }

  // Sinon, fallback SVG
  return <LamiLogo variant={variant} size={size} className={className} />;
}
