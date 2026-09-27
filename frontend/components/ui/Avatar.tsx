"use client";

import { useMemo } from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-16 w-16 text-xl",
};

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

interface AvatarProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Ring autour de l'avatar (utile pour le header) */
  ring?: boolean;
}

/**
 * Avatar réutilisable.
 * - Si `imageUrl` est fourni → affiche l'image
 * - Sinon → génère un avatar à partir des initiales + couleur stable
 */
export default function Avatar({
  firstName,
  lastName,
  email,
  imageUrl,
  size = "md",
  className = "",
  ring = false,
}: AvatarProps) {
  // Calcul des initiales
  const initials = useMemo(() => {
    const f = (firstName || "").trim();
    const l = (lastName || "").trim();
    if (f || l) {
      return `${f[0] || ""}${l[0] || ""}`.toUpperCase() || "?";
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  }, [firstName, lastName, email]);

  // Couleur stable basée sur un hash de l'email (ou du nom)
  const gradient = useMemo(() => {
    const seed = email || `${firstName || ""}${lastName || ""}`;
    if (!seed) return GRADIENTS[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
  }, [email, firstName, lastName]);

  const sizeClass = SIZE_CLASSES[size];
  const ringClass = ring
    ? "ring-2 ring-white dark:ring-slate-900"
    : "";

  // Si une image est fournie → on l'affiche
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${firstName || ""} ${lastName || ""}`.trim() || "Avatar"}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${ringClass} ${className}`}
      />
    );
  }

  // Sinon → initiales + dégradé
  return (
    <span
      className={`${sizeClass} ${ringClass} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white ${className}`}
      aria-label={`${firstName || ""} ${lastName || ""}`.trim() || "Utilisateur"}
    >
      {initials}
    </span>
  );
}