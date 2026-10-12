"use client";

interface LamiLogoProps {
  /** Taille globale (hauteur en px) */
  size?: number;
  /** Variante d'affichage */
  variant?: "full" | "icon" | "compact";
  /** Classe CSS optionnelle */
  className?: string;
  /** Couleur du texte (auto pour light/dark) */
  colorScheme?: "auto" | "light" | "dark";
}

/**
 * Logo L'AMI - Version SVG vectorielle
 *
 * Variantes :
 * - full    : logo complet avec baseline
 * - icon    : juste les 3 cercles + L'AMI (pour sidebar, favicon)
 * - compact : L'AMI seul en texte (pour header)
 */
export default function LamiLogo({
  size = 40,
  variant = "full",
  className = "",
  colorScheme = "auto",
}: LamiLogoProps) {
  // Couleurs de la charte
  const YELLOW = "#FFC107";
  const GREEN = "#8BC34A";
  const BLUE = "#2196F3";
  const BLUE_DARK = "#1976D2";
  const RED = "#E53935";

  // Couleurs adaptatives
  const textColor =
    colorScheme === "light"
      ? "#0F172A"
      : colorScheme === "dark"
      ? "#F8FAFC"
      : "currentColor";

  // ============================================================
  // VARIANTE : ICON (3 capsules + L'AMI)
  // ============================================================
  if (variant === "icon") {
    return (
      <svg
        width={size * 2.5}
        height={size}
        viewBox="0 0 100 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="L'AMI"
      >
        {/* Capsule JAUNE */}
        <ellipse cx="20" cy="20" rx="14" ry="12" fill={YELLOW} />
        {/* Capsule VERTE (overlap) */}
        <ellipse cx="45" cy="20" rx="14" ry="12" fill={GREEN} />
        {/* Capsule BLEUE (overlap) */}
        <ellipse cx="70" cy="20" rx="14" ry="12" fill={BLUE} />

        {/* Texte L'AMI en blanc dans les capsules */}
        <text
          x="20"
          y="26"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="16"
          fontWeight="800"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          L
        </text>
        <text
          x="45"
          y="26"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="16"
          fontWeight="800"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          A
        </text>
        <text
          x="70"
          y="26"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="16"
          fontWeight="800"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          M
        </text>

        {/* "i" en bleu à droite */}
        <text
          x="90"
          y="26"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="16"
          fontWeight="800"
          fill={BLUE_DARK}
          textAnchor="middle"
        >
          i
        </text>
      </svg>
    );
  }

  // ============================================================
  // VARIANTE : COMPACT (L'AMI seul)
  // ============================================================
  if (variant === "compact") {
    return (
      <svg
        width={size * 2.5}
        height={size}
        viewBox="0 0 100 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="L'AMI"
      >
        <text
          x="0"
          y="30"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="30"
          fontWeight="800"
          fill={textColor}
          letterSpacing="-1"
        >
          L&apos;
          <tspan fill={BLUE}>AMI</tspan>
        </text>
      </svg>
    );
  }

  // ============================================================
  // VARIANTE : FULL (logo complet avec baseline)
  // ============================================================
  return (
    <svg
      width={size * 5}
      height={size}
      viewBox="0 0 250 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="L'AMI - L'Assistance & Maintenance Informatique"
    >
      {/* ============ CAPSULES ============ */}
      {/* Jaune */}
      <ellipse cx="22" cy="18" rx="18" ry="14" fill={YELLOW} />
      {/* Verte */}
      <ellipse cx="52" cy="18" rx="18" ry="14" fill={GREEN} />
      {/* Bleue */}
      <ellipse cx="82" cy="18" rx="18" ry="14" fill={BLUE} />

      {/* ============ LETTRES DANS LES CAPSULES ============ */}
      <text
        x="22"
        y="25"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        L
      </text>
      <text
        x="52"
        y="25"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        A
      </text>
      <text
        x="82"
        y="25"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        M
      </text>

      {/* ============ "i" + "nformatique" ============ */}
      <text
        x="102"
        y="25"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="18"
        fontWeight="800"
        fill={BLUE_DARK}
      >
        i
      </text>
      <text
        x="108"
        y="25"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="12"
        fontWeight="500"
        fill={BLUE_DARK}
        fontStyle="italic"
      >
        nformatique
      </text>

      {/* ============ BASELINE ============ */}
      <text
        x="0"
        y="46"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="7"
        fontWeight="600"
        letterSpacing="0.5"
      >
        <tspan fill={BLUE_DARK}>L&apos;Assistance</tspan>
        <tspan fill={textColor}> &amp; </tspan>
        <tspan fill={BLUE_DARK}>Maintenance</tspan>
        <tspan fill={textColor}> </tspan>
        <tspan fill={RED}>Informatique</tspan>
      </text>
    </svg>
  );
}
