/**
 * Devises L'AMI - Madagascar (Ariary)
 *
 * Les prix catalogue peuvent etre en EUR (seed) ou deja en MGA.
 * NEXT_PUBLIC_PRICES_IN_MGA=true => pas de conversion
 * sinon conversion EUR -> MGA (taux configurable)
 */

export type CurrencyCode = "MGA" | "EUR";

const EUR_TO_MGA = Number(process.env.NEXT_PUBLIC_EUR_TO_MGA || 4800);
const PRICES_IN_MGA = process.env.NEXT_PUBLIC_PRICES_IN_MGA === "true";

export function toAriary(amount: number): number {
  if (PRICES_IN_MGA) return Math.round(amount);
  // Si le montant ressemble deja a de l'Ariary (> 10 000), ne pas reconvertir
  if (amount >= 10000) return Math.round(amount);
  return Math.round(amount * EUR_TO_MGA);
}

/** Format style AM Info : "1,800,000 Ar" */
export function formatAriary(amount: number): string {
  const ar = toAriary(amount);
  const formatted = ar.toLocaleString("en-US");
  return `${formatted} Ar`;
}

export function formatPrice(amount: number, currency: CurrencyCode = "MGA"): string {
  if (currency === "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return formatAriary(amount);
}

export function currencyLabel(code: CurrencyCode): string {
  return code === "MGA" ? "Ariary (MGA)" : "Euro (EUR)";
}

/** Operateurs Mobile Money Madagascar */
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
