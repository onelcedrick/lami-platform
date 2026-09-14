"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import LazyImage from "@/components/ui/LazyImage";
import ShareProductButton from "@/components/catalog/ShareProductButton";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import {
  Discount,
  applyDiscount,
  bestDiscountForProduct,
  formatDiscountValue,
} from "@/lib/discount";
import { CartIcon, ChevronRightIcon, StarIcon } from "@/components/ui/icons";

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  sku: string;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  stock_alert?: number;
  status: string;
  is_featured?: boolean;
  description?: string;
  short_description?: string;
  images?: string[];
  tags?: string[];
  usage_tags?: string[];
  rating?: number;
  review_count?: number;
  sales_count?: number;
  category_id?: string;
  category_name?: string;
  attributes?: Record<string, unknown>;
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const addItem = useCartStore((s) => s.addItem);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        api.listActiveDiscounts().then((dr) => {
          if (dr.success && dr.data) setDiscounts(dr.data as Discount[]);
        });
        // 1) Par slug (lien partage)
        let res = await api.getProductBySlug(slug);
        if ((!res.success || !res.data) && slug.length > 8) {
          // 2) Fallback : id direct (anciens liens /admin)
          res = await api.getProduct(slug);
        }
        if (!cancelled) {
          if (res.success && res.data) {
            setProduct(res.data as Product);
          } else {
            setError("Produit introuvable ou indisponible");
          }
        }
      } catch {
        if (!cancelled) setError("Impossible de charger le produit");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleAdd = () => {
    if (!product || product.stock <= 0) return;
    const promo = bestDiscountForProduct(discounts, {
      id: product.id,
      category_id: product.category_id,
      price: product.price,
    });
    const finalPrice = applyDiscount(product.price, promo);
    addItem({
      productId: product.id,
      name: product.name,
      price: finalPrice,
      quantity: qty,
      image: product.images?.[0],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const sharePath = product
    ? `/product/${encodeURIComponent(product.slug || product.id)}`
    : `/product/${encodeURIComponent(slug)}`;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">
        Chargement du produit...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Produit introuvable
        </h1>
        <p className="mt-2 text-slate-500">
          {error || "Ce lien n'est plus valide ou le produit a ete retire."}
        </p>
        <Link href="/catalog" className="btn-primary mt-6 inline-flex">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  const images =
    product.images && product.images.length > 0 ? product.images : [""];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Fil d'Ariane */}
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/" className="hover:text-primary-600">
          Accueil
        </Link>
        <ChevronRightIcon size={14} />
        <Link href="/catalog" className="hover:text-primary-600">
          Catalogue
        </Link>
        <ChevronRightIcon size={14} />
        <span className="line-clamp-1 text-slate-800 dark:text-slate-200">
          {product.name}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galerie */}
        <div>
          <div className="card flex aspect-square items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            <LazyImage
              src={images[activeImage]}
              alt={product.name}
              fallbackText={product.brand}
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    i === activeImage
                      ? "border-primary-500"
                      : "border-transparent"
                  }`}
                >
                  <LazyImage src={src} alt="" fallbackText={String(i + 1)} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Infos */}
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            {product.brand}
            {product.category_name ? ` · ${product.category_name}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            {product.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {typeof product.rating === "number" && product.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-500">
                <StarIcon size={16} />
                {product.rating.toFixed(1)}
                {product.review_count ? (
                  <span className="text-slate-400">
                    ({product.review_count})
                  </span>
                ) : null}
              </span>
            )}
            {product.is_featured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Vedette
              </span>
            )}
            <span className="text-xs text-slate-400">SKU {product.sku}</span>
          </div>

          {(() => {
            const promo = bestDiscountForProduct(discounts, {
              id: product.id,
              category_id: product.category_id,
              price: product.price,
            });
            const finalPrice = applyDiscount(product.price, promo);
            const hasPromo = !!(promo && finalPrice < product.price);
            return (
              <>
                {hasPromo && (
                  <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                    Promo {promo!.name} : -{formatDiscountValue(promo!)}
                  </p>
                )}
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {formatAriary(finalPrice)}
                  </span>
                  {(hasPromo ||
                    (product.compare_at_price &&
                      product.compare_at_price > product.price)) && (
                    <span className="text-lg text-slate-400 line-through">
                      {formatAriary(
                        hasPromo ? product.price : (product.compare_at_price as number)
                      )}
                    </span>
                  )}
                </div>
              </>
            );
          })()}

          <p
            className={`mt-2 text-sm font-medium ${
              product.stock > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {product.stock > 0
              ? `En stock (${product.stock} disponible${product.stock > 1 ? "s" : ""})`
              : "Rupture de stock"}
          </p>

          {product.short_description && (
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              {product.short_description}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Diminuer quantite"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-medium">
                {qty}
              </span>
              <button
                type="button"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() =>
                  setQty((q) => Math.min(product.stock || 1, q + 1))
                }
                aria-label="Augmenter quantite"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={product.stock <= 0}
              className="btn-primary disabled:opacity-50"
            >
              <CartIcon size={18} />
              {added ? "Ajoute au panier" : "Ajouter au panier"}
            </button>

            <ShareProductButton
              productName={product.name}
              path={sharePath}
            />
            <FavoriteButton
              product={product}
              size={22}
              className="border border-slate-200 dark:border-slate-700"
            />
          </div>

          {/* Lien partage visible */}
          <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
            <p className="text-xs font-medium uppercase text-slate-400">
              Lien partageable
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
              {typeof window !== "undefined"
                ? `${window.location.origin}${sharePath}`
                : sharePath}
            </p>
          </div>

          {(product.tags?.length || product.usage_tags?.length) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {[...(product.usage_tags || []), ...(product.tags || [])].map(
                (t) => (
                  <Link
                    key={t}
                    href={`/catalog?search=${encodeURIComponent(t)}`}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-primary-50 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {t}
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description longue */}
      {product.description && (
        <section className="card mt-10 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Description
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {product.description}
          </p>
        </section>
      )}

      {/* Attributs */}
      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Caracteristiques
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(product.attributes).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm dark:border-slate-800"
              >
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
