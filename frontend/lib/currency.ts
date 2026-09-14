/**
 * Devises L'AMI - Madagascar (Ariary)
 *
 * Les prix catalogue sont stockés en MGA (Ariary).
 * La conversion EUR → MGA n'est appliquée que si le montant est
 * clairement exprimé en euros (cf. NEXT_PUBLIC_PRICES_IN_MGA).
 */

export type CurrencyCode = "MGA" | "EUR";

const EUR_TO_MGA = Number(process.env.NEXT_PUBLIC_EUR_TO_MGA || 4800);

// true = les prix sont déjà en Ariary (recommandé)
const PRICES_IN_MGA = process.env.NEXT_PUBLIC_PRICES_IN_MGA !== "false";

/**
 * Convertit un montant en Ariary.
 * - Si PRICES_IN_MGA=true, le montant est considéré comme déjà en MGA.
 * - Sinon, un montant < 5000 est considéré comme EUR et converti.
 */
export function toAriary(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (PRICES_IN_MGA) return Math.round(amount);
  // Heuristique : un prix unitaire en EUR est typiquement < 5000
  if (amount >= 5000) return Math.round(amount);
  return Math.round(amount * EUR_TO_MGA);
}

/**
 * Formate un montant en Ariary, ex : "1 800 000 Ar"
 * Utilise le format français (espace comme séparateur de milliers).
 */
export function formatAriary(amount: number): string {
  const ar = toAriary(amount);
  return `${ar.toLocaleString("fr-FR").replace(/\u202f/g, " ")} Ar`;
}

/**
 * Formate un prix selon la devise choisie.
 */
export function formatPrice(
  amount: number,
  currency: CurrencyCode = "MGA"
): string {
  if (currency === "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return formatAriary(amount);
}

/**
 * Libellé lisible d'un code devise.
 */
export function currencyLabel(code: CurrencyCode): string {
  return code === "MGA" ? "Ariary (MGA)" : "Euro (EUR)";
}

/**
 * Fournisseurs Mobile Money disponibles à Madagascar.
 */
export const MOBILE_MONEY_PROVIDERS = [
  {
    id: "mvola",
    name: "MVola",
    prefix: "034",
    color: "#111827",
    icon: "phone",
  },
  {
    id: "orange_money",
    name: "Orange Money",
    prefix: "032",
    color: "#f97316",
    icon: "orange",
  },
  {
    id: "airtel_money",
    name: "Airtel Money",
    prefix: "033",
    color: "#ef4444",
    icon: "airtel",
  },
] as const;

export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];
export type MobileMoneyProviderId = MobileMoneyProvider["id"];
