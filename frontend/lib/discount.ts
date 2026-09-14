/**
 * Promotions / remises — L'AMI
 *
 * Les prix et les valeurs de remise fixe sont exprimés en Ariary (MGA).
 * Le type de remise est soit un pourcentage, soit un montant fixe.
 */

import { toAriary } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscountType = "percentage" | "fixed_amount";
export type DiscountTarget = "global" | "category" | "product";

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  target: DiscountTarget;
  target_id?: string;
  target_label?: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Application d'une remise
// ---------------------------------------------------------------------------

/**
 * Applique une promotion sur un prix déjà exprimé en Ariary.
 *
 * @param priceAr Prix de base en Ariary
 * @param d       Promotion à appliquer (ou null / undefined)
 * @returns       Prix final en Ariary (jamais négatif)
 */
export function applyDiscount(
  priceAr: number,
  d: Discount | null | undefined
): number {
  if (!d || !d.is_active || priceAr <= 0) return priceAr;

  let result = priceAr;

  if (d.type === "percentage") {
    const pct = Math.min(Math.max(d.value, 0), 100);
    result = priceAr * (1 - pct / 100);
  } else if (d.type === "fixed_amount") {
    // ⚠️ Fallback : si la valeur est très petite et que le prix est grand,
    // on suppose que la remise a été saisie en EUR → conversion.
    // Cette heuristique est fragile ; à terme, stocker la devise
    // avec la remise et supprimer cette logique.
    let cut = d.value;
    if (cut > 0 && cut < 5000 && priceAr >= 5000) {
      cut = toAriary(cut);
    }
    result = priceAr - cut;
  }

  return result < 0 ? 0 : Math.round(result);
}

// ---------------------------------------------------------------------------
// Applicabilité
// ---------------------------------------------------------------------------

/**
 * Vérifie si une promotion s'applique au produit donné.
 */
export function isDiscountApplicable(
  d: Discount,
  product: { id: string; category_id?: string }
): boolean {
  if (!d.is_active) return false;
  if (d.target === "global") return true;
  if (d.target === "category") return d.target_id === product.category_id;
  if (d.target === "product") return d.target_id === product.id;
  return false;
}

// ---------------------------------------------------------------------------
// Sélection de la meilleure remise
// ---------------------------------------------------------------------------

/**
 * Retourne la promotion qui donne le prix final le plus bas
 * pour un produit donné, ou `null` si aucune ne s'applique.
 */
export function bestDiscountForProduct(
  discounts: Discount[],
  product: { id: string; category_id?: string; price: number }
): Discount | null {
  const base = toAriary(product.price);
  let best: Discount | null = null;
  let bestPrice = base;

  for (const d of discounts) {
    if (!isDiscountApplicable(d, product)) continue;
    const p = applyDiscount(base, d);
    if (p < bestPrice) {
      bestPrice = p;
      best = d;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/**
 * Retourne un libellé lisible de la remise :
 * - pourcentage → "15%"
 * - montant fixe → "50 000 Ar"
 */
export function formatDiscountValue(d: Discount): string {
  if (d.type === "percentage") {
    const pct = Math.min(Math.max(d.value, 0), 100);
    return `${pct}%`;
  }
  const ar = toAriary(d.value);
  return `${ar.toLocaleString("fr-FR").replace(/\u202f/g, " ")} Ar`;
}
