/**
 * ============================================================
 * CARTE PRODUIT INLINE DANS LE CHAT (v2)
 * ============================================================
 * Affiche un produit renvoyé par l'IA sous forme de carte compacte :
 * image, marque, nom, prix Ariary, stock, note, bouton panier.
 *
 * GESTION DES IMAGES (corrigée) :
 *  - URL absolue (http/https, ex: MinIO :9000)   → utilisée telle quelle
 *  - Chemin relatif (ex: /images/video-card/…)   → servi par Next.js depuis
 *    le dossier `public/` (NE PAS préfixer par l'API !)
 *  - Fichier introuvable (404)                   → placeholder marque propre
 *    via onError, jamais de texte d'alt cassé à l'écran
 *
 * Option : si tes images sont hébergées ailleurs (ex: service catalogue),
 * définis NEXT_PUBLIC_IMAGES_BASE=http://localhost:8083 dans .env.local
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAriary } from "@/lib/currency";
import type { ChatProduct } from "@/lib/chat/chat-types";
import { CartIcon, StarIcon } from "@/components/ui/icons";

// ------------------------------------------------------------
// Résolution d'URL d'image
// ------------------------------------------------------------

/** Base optionnelle pour les images relatives (vide = Next public/) */
const IMAGES_BASE = process.env.NEXT_PUBLIC_IMAGES_BASE || "";

/**
 * Résout l'URL finale d'une image produit.
 * @returns URL utilisable dans un <img>, ou null si aucune image
 */
export function resolveProductImage(image?: string | null): string | null {
  if (!image) return null;
  // URL absolue (MinIO, CDN…) → inchangée
  if (/^https?:\/\//i.test(image)) return image;
  // Chemin relatif → public/ de Next (ou base configurée)
  const path = image.startsWith("/") ? image : `/${image}`;
  return `${IMAGES_BASE}${path}`;
}

// ------------------------------------------------------------
// Image avec repli automatique
// ------------------------------------------------------------

interface ProductImageProps {
  src: string | null;
  alt: string;
  /** Texte de repli (marque) si l'image est introuvable */
  fallback: string;
}

/**
 * <img> défensif : si le chargement échoue (404, réseau),
 * on affiche un placeholder propre au lieu d'une image cassée.
 */
function ProductImage({ src, alt, fallback }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  // Pas d'URL ou chargement échoué → placeholder marque
  if (!src || failed) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-700"
        aria-label={alt}
        role="img"
      >
        <span className="select-none text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {(fallback || "?").slice(0, 6)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
}

// ------------------------------------------------------------
// Carte produit
// ------------------------------------------------------------

interface ProductCardChatProps {
  product: ChatProduct;
  onAddToCart: (product: ChatProduct) => void;
}

export default function ProductCardChat({
  product,
  onAddToCart,
}: ProductCardChatProps) {
  const imageUrl = resolveProductImage(product.image);
  const isOutOfStock = product.stock <= 0;
  const href = `/product/${encodeURIComponent(product.slug || product.id)}`;

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-primary-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-700">
      {/* Image du produit (avec repli) */}
      <Link
        href={href}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700"
        aria-label={`Voir ${product.name}`}
      >
        <ProductImage
          src={imageUrl}
          alt={product.name}
          fallback={product.brand || product.name}
        />
      </Link>

      {/* Informations */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {product.brand}
        </p>
        <Link
          href={href}
          className="line-clamp-2 text-xs font-semibold text-slate-900 transition hover:text-primary-600 dark:text-slate-100 dark:hover:text-primary-400"
        >
          {product.name}
        </Link>

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
            {formatAriary(product.price)}
          </span>
          {product.rating && product.rating > 0 ? (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
              <StarIcon size={10} className="fill-current" />
              {product.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        {/* Stock : n'affiche "Rupture" QUE si le champ est present et a 0.
            Un stock absent (undefined) ne doit PAS mentir. */}
        {typeof product.stock === "number" && (
          <p
            className={`text-[10px] ${
              isOutOfStock
                ? "text-red-500"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isOutOfStock ? "Rupture" : `En stock (${product.stock})`}
          </p>
        )}
      </div>

      {/* Bouton ajouter au panier */}
      {!isOutOfStock && (
        <button
          type="button"
          onClick={() => onAddToCart(product)}
          className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg bg-primary-600 text-white transition hover:bg-primary-700 active:scale-95"
          aria-label={`Ajouter ${product.name} au panier`}
          title="Ajouter au panier"
        >
          <CartIcon size={14} />
        </button>
      )}
    </div>
  );
}
