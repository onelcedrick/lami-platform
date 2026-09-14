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

export function applyDiscount(price: number, d: Discount | null | undefined): number {
  if (!d || !d.is_active || price <= 0) return price;
  let result = price;
  if (d.type === "percentage") {
    result = price * (1 - d.value / 100);
  } else if (d.type === "fixed_amount") {
    result = price - d.value;
  }
  return result < 0 ? 0 : result;
}

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

/** Meilleure promo = prix final le plus bas */
export function bestDiscountForProduct(
  discounts: Discount[],
  product: { id: string; category_id?: string; price: number }
): Discount | null {
  let best: Discount | null = null;
  let bestPrice = product.price;
  for (const d of discounts) {
    if (!isDiscountApplicable(d, product)) continue;
    const p = applyDiscount(product.price, d);
    if (p < bestPrice) {
      bestPrice = p;
      best = d;
    }
  }
  return best;
}

export function formatDiscountValue(d: Discount): string {
  if (d.type === "percentage") return `${d.value}%`;
  return `${Number(d.value).toLocaleString("en-US")} Ar`;
}
