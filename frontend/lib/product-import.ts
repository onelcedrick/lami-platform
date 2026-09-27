/**
 * Parse CSV / TSV et mappe les colonnes flexibles pour import produits L'AMI.
 * Version 2 : ajoute la résolution de catégories + détection de doublons.
 */

export interface ImportRow {
  name: string;
  sku: string;
  brand: string;
  category_id: string;        // id résolu si trouvé, sinon nom brut
  category_name: string;      // nom original du CSV
  category_resolved: boolean; // true si on a trouvé l'id
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
  _status: "ok" | "error" | "duplicate";
  _errors: string[];
  _raw?: Record<string, string>;
}

export interface CategoryLite {
  id: string;
  name: string;
  slug?: string;
}

const ALIASES: Record<string, string[]> = {
  name: ["name", "nom", "product", "produit", "product_name", "titre", "title"],
  sku: ["sku", "ref", "reference", "code", "code_produit"],
  brand: ["brand", "marque", "fabricant", "manufacturer"],
  category: ["category", "categorie", "catégorie", "category_name", "category_id", "type"],
  price: ["price", "prix", "tarif", "montant", "price_mga", "prix_ar"],
  stock: ["stock", "quantite", "quantité", "qty", "quantity", "qte"],
  stock_alert: ["stock_alert", "alerte_stock", "seuil", "alert"],
  description: ["description", "details", "détails", "detail", "desc"],
  short_description: ["short_description", "description_courte", "resume", "résumé", "summary"],
  images: ["images", "image", "image_url", "url_image", "photo", "photos"],
  tags: ["tags", "tag", "mots_cles", "keywords"],
  usage_tags: ["usage_tags", "usage", "usages"],
  is_featured: ["is_featured", "vedette", "featured", "promo_home"],
};

const RESERVED = new Set(
  Object.values(ALIASES).flat().map((s) => s.toLowerCase())
);

function normKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function findField(row: Record<string, string>, field: keyof typeof ALIASES): string {
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
  return v.split(/[|;,]/).map((x) => x.trim()).filter(Boolean);
}

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

/**
 * Mappe les lignes brutes vers des produits structurés.
 * @param rows lignes CSV brutes
 * @param categories liste des catégories existantes (pour résoudre les noms → ids)
 * @param existingSkus ensemble des SKUs déjà en base (pour détecter les doublons)
 */
export function mapRowsToProducts(
  rows: Record<string, string>[],
  categories: CategoryLite[] = [],
  existingSkus: Set<string> = new Set()
): {
  products: ImportRow[];
  errors: string[];
  stats: {
    total: number;
    valid: number;
    errors: number;
    duplicates: number;
    categories: Record<string, number>;
  };
} {
  const products: ImportRow[] = [];
  const errors: string[] = [];
  const bySku = new Map<string, ImportRow>();
  const seenInFile = new Set<string>();

  // Index catégories par nom/slug normalisé
  const catIndex = new Map<string, CategoryLite>();
  for (const c of categories) {
    catIndex.set(normKey(c.name), c);
    if (c.slug) catIndex.set(normKey(c.slug), c);
    catIndex.set(c.id, c);
  }

  const categoriesCount: Record<string, number> = {};

  rows.forEach((raw, idx) => {
    const line = idx + 2;
    const name = findField(raw, "name");
    const sku = findField(raw, "sku");
    const brand = findField(raw, "brand") || "Generic";
    const category = findField(raw, "category");
    const priceStr = findField(raw, "price").replace(/\s/g, "").replace(",", ".");
    const price = Number(priceStr);
    const stock = Number(findField(raw, "stock") || "0") || 0;
    const stock_alert = Number(findField(raw, "stock_alert") || "5") || 5;
    const description = findField(raw, "description") || name || "Sans description";
    const short_description = findField(raw, "short_description");
    const images = parseList(findField(raw, "images"));
    const tags = parseList(findField(raw, "tags"));
    const usage_tags = parseList(findField(raw, "usage_tags"));
    const featuredRaw = findField(raw, "is_featured");
    const is_featured = featuredRaw ? parseBool(featuredRaw) : false;

    const rowErrors: string[] = [];

    // --- Validations ---
    if (!name) rowErrors.push("nom manquant");
    if (!sku) rowErrors.push("SKU manquant");
    if (!category) rowErrors.push("catégorie manquante");
    if (!(price > 0)) rowErrors.push("prix invalide (>0 requis)");

    // --- Résolution de catégorie ---
    let category_id = category;
    let category_resolved = false;
    const cat = catIndex.get(normKey(category));
    if (cat) {
      category_id = cat.id;
      category_resolved = true;
    }

    // --- Détection doublon ---
    let status: "ok" | "error" | "duplicate" = "ok";
    if (rowErrors.length > 0) {
      status = "error";
      errors.push(`Ligne ${line} : ${rowErrors.join(", ")}`);
    } else if (sku) {
      const skuLower = sku.toLowerCase();
      if (seenInFile.has(skuLower)) {
        status = "duplicate";
        rowErrors.push("SKU en double dans le fichier");
      } else if (existingSkus.has(skuLower)) {
        status = "duplicate";
        rowErrors.push("SKU déjà en base");
      } else {
        seenInFile.add(skuLower);
      }
    }

    // --- Attributs personnalisés ---
    const attributes: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!v || !String(v).trim()) continue;
      const nk = normKey(k);
      if (RESERVED.has(nk)) continue;
      const num = Number(String(v).replace(",", "."));
      attributes[nk] =
        !Number.isNaN(num) && /^-?\d/.test(String(v).trim())
          ? num
          : String(v).trim();
    }

    const product: ImportRow = {
      name,
      sku,
      brand,
      category_id,
      category_name: category,
      category_resolved,
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
      _status: status,
      _errors: rowErrors,
      _raw: raw,
    };

    if (status === "ok") {
      bySku.set(sku.toLowerCase(), product);
      categoriesCount[category] = (categoriesCount[category] || 0) + 1;
    }
    products.push(product);
  });

  const valid = products.filter((p) => p._status === "ok").length;
  const dupCount = products.filter((p) => p._status === "duplicate").length;

  return {
    products,
    errors,
    stats: {
      total: rows.length,
      valid,
      errors: products.filter((p) => p._status === "error").length,
      duplicates: dupCount,
      categories: categoriesCount,
    },
  };
}

/** Filtre les produits valides pour l'import */
export function getValidProducts(products: ImportRow[]): ImportRow[] {
  return products.filter((p) => p._status === "ok");
}

/** Génère un CSV des erreurs pour correction */
export function buildErrorsCsv(products: ImportRow[]): string {
  const lines = ["ligne;statut;erreurs;sku;nom;categorie"];
  products
    .filter((p) => p._status !== "ok")
    .forEach((p) => {
      lines.push(
        [
          p._line,
          p._status === "duplicate" ? "doublon" : "erreur",
          p._errors.join(" | "),
          p.sku,
          p.name,
          p.category_name,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";")
      );
    });
  return lines.join("\n");
}

export function downloadErrorsCsv(products: ImportRow[]) {
  const csv = buildErrorsCsv(products);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lami-import-erreurs-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Modele CSV enrichi (10 lignes) */
export const IMPORT_TEMPLATE_CSV = [
  "nom;sku;marque;categorie;prix;stock;alerte_stock;description;description_courte;image;tags;usage;vedette;origine;annee;caracteristiques",
  "Ecran Samsung 24 pouces;MON-SAM-24F;Samsung;Ecrans;450000;15;5;Ecran Full HD 24 pouces HDMI;Ecran 24 FHD;https://exemple.com/ecran.jpg;ecran|hdmi;bureautique;oui;Coree;2024;IPS 75Hz",
  "Clavier mecanique RGB;KB-MEC-RGB01;Generic;Claviers;85000;30;8;Clavier mecanique switches bleus;Clavier RGB;https://exemple.com/kb.jpg;clavier|rgb;gaming;non;Chine;2023;USB-C",
  "Cable Ethernet Cat6 5m;CAB-ETH-C6-5;Generic;Accessoires;12000;100;20;Cable reseau Cat6 5 metres;Cable Cat6 5m;;reseau|cable;bureautique;non;Chine;2025;",
  "Souris Logitech MX Master 3;MOU-LOG-MX3;Logitech;Bureautique;350000;20;5;Souris ergonomique sans fil;MX Master 3;;souris|sans-fil;bureautique;non;Suisse;2024;8000DPI|Bluetooth",
  "Disque dur externe 2TB;HDD-EXT-2TB;Seagate;Stockage;280000;25;8;Disque dur externe USB 3.0;HDD 2TB;;hdd|externe|usb;bureautique;non;Thailande;2024;USB3.0",
  "Webcam Full HD 1080p;CAM-FHD-01;Logitech;Peripheriques;180000;18;6;Webcam streaming 1080p 30fps;Webcam FHD;;webcam|streaming;streaming;non;Chine;2024;1080p|30fps",
  "Casque gaming 7.1;HEAD-71-RGB;HyperX;Audio;420000;12;4;Casque surround 7.1 avec micro;Casque 7.1;;casque|audio|7.1;gaming;oui;USA;2024;7.1|USB",
  "Alimentation 750W Gold;PSU-750-GOLD;Corsair;Alimentation;650000;10;3;PSU 750W 80+ Gold modulaire;PSU 750W;;psu|alimentation|750w;gaming;non;Chine;2024;80+Gold|Modulaire",
  "Ventilateur 120mm RGB;FAN-120-RGB;Corsair;Refroidissement;45000;50;15;Ventilateur 120mm RGB PWM;Ventilo 120;;ventilo|rgb|pwm;gaming;non;Chine;2024;120mm|PWM",
].join("\n");

export function downloadTemplate() {
  const blob = new Blob(["\uFEFF" + IMPORT_TEMPLATE_CSV], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lami-import-produits-modele.csv";
  a.click();
  URL.revokeObjectURL(url);
}