/**
 * Parse CSV / TSV et mappe les colonnes flexibles pour import produits L'AMI.
 * Compatible export Excel "Enregistrer sous > CSV".
 */

export interface ImportRow {
  name: string;
  sku: string;
  brand: string;
  category_id: string; // nom de categorie ou id
  price: number;
  stock: number;
  stock_alert: number;
  description: string;
  short_description: string;
  images: string[];
  tags: string[];
  usage_tags: string[];
  is_featured: boolean;
  attributes: Record<string, string | number | boolean>;
  _line: number;
  _raw?: Record<string, string>;
}

const ALIASES: Record<string, string[]> = {
  name: ["name", "nom", "product", "produit", "product_name", "titre", "title"],
  sku: ["sku", "ref", "reference", "code", "code_produit"],
  brand: ["brand", "marque", "fabricant", "manufacturer"],
  category: [
    "category",
    "categorie",
    "catégorie",
    "category_name",
    "category_id",
    "type",
  ],
  price: ["price", "prix", "tarif", "montant", "price_mga", "prix_ar"],
  stock: ["stock", "quantite", "quantité", "qty", "quantity", "qte"],
  stock_alert: ["stock_alert", "alerte_stock", "seuil", "alert"],
  description: ["description", "details", "détails", "detail", "desc"],
  short_description: [
    "short_description",
    "description_courte",
    "resume",
    "résumé",
    "summary",
  ],
  images: ["images", "image", "image_url", "url_image", "photo", "photos"],
  tags: ["tags", "tag", "mots_cles", "keywords"],
  usage_tags: ["usage_tags", "usage", "usages"],
  is_featured: ["is_featured", "vedette", "featured", "promo_home"],
};

/** Colonnes libres -> attributes (origine, annee, taille, etc.) */
const RESERVED = new Set(
  Object.values(ALIASES)
    .flat()
    .map((s) => s.toLowerCase())
);

function normKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function findField(
  row: Record<string, string>,
  field: keyof typeof ALIASES
): string {
  const keys = Object.keys(row);
  for (const alias of ALIASES[field]) {
    const hit = keys.find((k) => normKey(k) === normKey(alias));
    if (hit && row[hit] !== undefined && String(row[hit]).trim() !== "") {
      return String(row[hit]).trim();
    }
  }
  return "";
}

function parseBool(v: string): boolean {
  const s = v.toLowerCase();
  return ["1", "true", "oui", "yes", "y", "x"].includes(s);
}

function parseList(v: string): string[] {
  if (!v) return [];
  return v
    .split(/[|;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Detecte separateur CSV */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const counts = {
    ";": (first.match(/;/g) || []).length,
    "\t": (first.match(/\t/g) || []).length,
    ",": (first.match(/,/g) || []).length,
  };
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCSV(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const cleaned = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(cleaned);
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0], delim);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delim);
    if (cols.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

export function mapRowsToProducts(
  rows: Record<string, string>[]
): { products: ImportRow[]; errors: string[] } {
  const products: ImportRow[] = [];
  const errors: string[] = [];

  rows.forEach((raw, idx) => {
    const line = idx + 2; // + header
    const name = findField(raw, "name");
    const sku = findField(raw, "sku");
    const brand = findField(raw, "brand") || "Generic";
    const category = findField(raw, "category");
    const priceStr = findField(raw, "price").replace(/\s/g, "").replace(",", ".");
    const price = Number(priceStr);
    const stock = Number(findField(raw, "stock") || "0") || 0;
    const stock_alert = Number(findField(raw, "stock_alert") || "5") || 5;
    const description =
      findField(raw, "description") || name || "Sans description";
    const short_description = findField(raw, "short_description");
    const images = parseList(findField(raw, "images"));
    const tags = parseList(findField(raw, "tags"));
    const usage_tags = parseList(findField(raw, "usage_tags"));
    const featuredRaw = findField(raw, "is_featured");
    const is_featured = featuredRaw ? parseBool(featuredRaw) : false;

    if (!name || !sku || !category || !(price > 0)) {
      errors.push(
        `Ligne ${line}: nom, SKU, categorie et prix (>0) sont obligatoires`
      );
      return;
    }

    const attributes: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!v || !String(v).trim()) continue;
      const nk = normKey(k);
      if (RESERVED.has(nk)) continue;
      // nombre ?
      const num = Number(String(v).replace(",", "."));
      attributes[nk] = !Number.isNaN(num) && String(v).trim() !== "" && /^-?\d/.test(String(v).trim())
        ? num
        : String(v).trim();
    }

    products.push({
      name,
      sku,
      brand,
      category_id: category,
      price,
      stock,
      stock_alert,
      description,
      short_description,
      images,
      tags,
      usage_tags,
      is_featured,
      attributes,
      _line: line,
      _raw: raw,
    });
  });

  return { products, errors };
}

/** Modele CSV telechargeable (Excel-compatible ; separateur) */
export const IMPORT_TEMPLATE_CSV = [
  "nom;sku;marque;categorie;prix;stock;alerte_stock;description;description_courte;image;tags;usage;vedette;origine;annee;caracteristiques",
  "Ecran Samsung 24 pouces;MON-SAM-24F;Samsung;Ecrans;450000;15;5;Ecran Full HD 24 pouces HDMI;Ecran 24 FHD;https://exemple.com/ecran.jpg;ecran|hdmi;bureautique;oui;Coree;2024;IPS 75Hz",
  "Clavier mecanique RGB;KB-MEC-RGB01;Generic;Claviers;85000;30;8;Clavier mecanique switches bleus;Clavier RGB;https://exemple.com/kb.jpg;clavier|rgb;gaming;non;Chine;2023;USB-C",
  "Cable Ethernet Cat6 5m;CAB-ETH-C6-5;Generic;Accessoires;12000;100;20;Cable reseau Cat6 5 metres;Cable Cat6 5m;;reseau|cable;bureautique;non;Chine;2025;",
].join("\n");

export function downloadTemplate() {
  const blob = new Blob([IMPORT_TEMPLATE_CSV], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lami-import-produits-modele.csv";
  a.click();
  URL.revokeObjectURL(url);
}
