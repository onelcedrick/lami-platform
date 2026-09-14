/**
 * Recherche intelligente + autosuggestion produits
 */

export interface SearchableProduct {
  id: string;
  name: string;
  slug?: string;
  brand?: string;
  sku?: string;
  short_description?: string;
  description?: string;
  tags?: string[];
  usage_tags?: string[];
  price?: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function productHaystack(p: SearchableProduct): string {
  const parts = [
    p.name,
    p.slug,
    p.brand,
    p.sku,
    p.short_description,
    p.description,
    ...(p.tags || []),
    ...(p.usage_tags || []),
  ];
  return normalize(parts.filter(Boolean).join(" "));
}

/** Score simple : prefixe nom/marque > inclusion multi-tokens */
export function scoreProduct(p: SearchableProduct, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(p.name || "");
  const brand = normalize(p.brand || "");
  const hay = productHaystack(p);
  let score = 0;

  if (name.startsWith(q)) score += 100;
  else if (name.includes(q)) score += 60;
  if (brand.startsWith(q)) score += 50;
  else if (brand.includes(q)) score += 30;
  if (normalize(p.sku || "").includes(q)) score += 40;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (hay.includes(t)) score += 15;
  }
  return score;
}

export function filterProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
  limit = 24
): T[] {
  const q = normalize(query);
  if (!q) return products.slice(0, limit);
  return products
    .map((p) => ({ p, s: scoreProduct(p, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}

export interface Suggestion {
  label: string;
  completion: string; // suffixe a completer (ex: "sung" pour "sams")
  productId?: string;
  brand?: string;
}

/**
 * Autosuggestion : a partir de "sams" propose "Samsung" avec completion "ung"
 * et des noms de produits matches.
 */
export function buildSuggestions(
  products: SearchableProduct[],
  query: string,
  max = 8
): Suggestion[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const seen = new Set<string>();
  const out: Suggestion[] = [];

  // 1) Completions de marque
  for (const p of products) {
    const brand = p.brand || "";
    const nb = normalize(brand);
    if (nb.startsWith(q) && brand.length > query.length) {
      const key = `b:${nb}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          label: brand,
          completion: brand.slice(query.length),
          brand,
        });
      }
    }
  }

  // 2) Completions de nom produit
  for (const p of products) {
    const name = p.name || "";
    const nn = normalize(name);
    if (nn.startsWith(q) && name.length > query.length) {
      const key = `n:${nn}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          label: name,
          completion: name.slice(query.length),
          productId: p.id,
          brand: p.brand,
        });
      }
    } else if (nn.includes(q)) {
      const key = `c:${p.id}`;
      if (!seen.has(key) && scoreProduct(p, q) > 0) {
        seen.add(key);
        out.push({
          label: name,
          completion: "",
          productId: p.id,
          brand: p.brand,
        });
      }
    }
    if (out.length >= max) break;
  }

  return out.slice(0, max);
}
