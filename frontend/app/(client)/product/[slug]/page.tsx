"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import { useCartStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";
import LazyImage from "@/components/ui/LazyImage";
import ShareProductButton from "@/components/catalog/ShareProductButton";
import FavoriteButton from "@/components/catalog/FavoriteButton";
import SimilarProducts from "@/components/product/SimilarProducts";
import {
  Discount,
  applyDiscount,
  bestDiscountForProduct,
  formatDiscountValue,
} from "@/lib/discount";
import {
  CartIcon,
  ChevronRightIcon,
  StarIcon,
  CheckIcon,
  TruckIcon,
  ShieldCheckIcon,
  RefreshIcon,
  PackageIcon,
  CpuIcon,
  ZapIcon,
} from "@/components/ui/icons";

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

type TabKey = "description" | "specs" | "avis" | "compatibilite";

export default function ProductDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const addItem = useCartStore((s) => s.addItem);
  const openChat = useChatStore((s) => s.openChat);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("description");

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
        let res = await api.getProductBySlug(slug);
        if ((!res.success || !res.data) && slug.length > 8) {
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

  useEffect(() => {
    setActiveImage(0);
  }, [slug]);

  // Navigation clavier
  useEffect(() => {
    if (!product?.images || product.images.length < 2) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveImage(
          (i) => (i - 1 + product.images!.length) % product.images!.length
        );
      } else if (e.key === "ArrowRight") {
        setActiveImage((i) => (i + 1) % product.images!.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product]);

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

  // ============================================
  // LOADING
  // ============================================
  if (loading) {
    return (
      <div className="mx-auto w-full px-4 py-16 text-center sm:px-6 lg:px-10 xl:px-16">
        <p className="text-[var(--fg-muted)]">Chargement du produit...</p>
      </div>
    );
  }

  // ============================================
  // ERREUR
  // ============================================
  if (error || !product) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20 text-center sm:px-6 lg:px-10">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-[var(--bg-muted)]">
          <PackageIcon size={32} className="text-[var(--fg-muted)]" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[var(--fg-primary)]">
          Produit introuvable
        </h1>
        <p className="mt-2 text-[var(--fg-secondary)]">
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

  // Prix + promo
  const promo = bestDiscountForProduct(discounts, {
    id: product.id,
    category_id: product.category_id,
    price: product.price,
  });
  const finalPrice = applyDiscount(product.price, promo);
  const hasPromo = !!promo && finalPrice < product.price;
  const comparePrice = hasPromo
    ? product.price
    : product.compare_at_price && product.compare_at_price > product.price
    ? product.compare_at_price
    : null;
  const discountPct = hasPromo && comparePrice
    ? Math.round(((comparePrice - finalPrice) / comparePrice) * 100)
    : null;

  // Attributs
  const attributes = (product.attributes || {}) as Record<string, unknown>;
  const attributeEntries = Object.entries(attributes).slice(0, 4);

  return (
    <div className="bg-[var(--bg-app)]">
      {/* ============================================ */}
      {/* BREADCRUMB                                    */}
      {/* ============================================ */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="mx-auto w-full px-4 py-3 sm:px-6 lg:px-10 xl:px-16">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)]">
            <Link href="/" className="hover:text-[var(--cyan)]">
              Accueil
            </Link>
            <ChevronRightIcon size={12} />
            <Link href="/catalog" className="hover:text-[var(--cyan)]">
              Catalogue
            </Link>
            {product.category_name && (
              <>
                <ChevronRightIcon size={12} />
                <Link
                  href={`/catalog?category=${encodeURIComponent(product.category_name)}`}
                  className="hover:text-[var(--cyan)]"
                >
                  {product.category_name}
                </Link>
              </>
            )}
            <ChevronRightIcon size={12} />
            <span className="line-clamp-1 text-[var(--fg-secondary)]">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* ============================================ */}
      {/* BLOC PRINCIPAL (Galerie + Info)               */}
      {/* ============================================ */}
      <section className="border-b border-[var(--border)] bg-[var(--bg-app)]">
        <div className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
          <div className="grid gap-8 lg:grid-cols-12">
            {/* ============ GALERIE ============ */}
            <div className="lg:col-span-6">
              <div className="sticky top-20">
                {/* Image principale */}
                <div className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                  <LazyImage
                    src={images[activeImage]}
                    alt={product.name}
                    fallbackText={product.brand}
                    fill
                  />

                  {/* Badge promo */}
                  {discountPct && (
                    <span className="absolute right-3 top-3 rounded-md bg-[var(--orange)] px-3 py-1.5 text-sm font-bold text-white shadow-md">
                      -{discountPct}%
                    </span>
                  )}

                  {/* Compteur */}
                  {images.length > 1 && (
                    <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                      {activeImage + 1} / {images.length}
                    </span>
                  )}

                  {/* Fleches navigation */}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveImage(
                            (i) => (i - 1 + images.length) % images.length
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[var(--navy-deep)] opacity-0 shadow-md transition hover:bg-white group-hover:opacity-100"
                        aria-label="Image precedente"
                      >
                        <ChevronRightIcon size={18} className="rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveImage((i) => (i + 1) % images.length)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[var(--navy-deep)] opacity-0 shadow-md transition hover:bg-white group-hover:opacity-100"
                        aria-label="Image suivante"
                      >
                        <ChevronRightIcon size={18} />
                      </button>
                    </>
                  )}
                </div>

                {/* Miniatures */}
                {images.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {images.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImage(i)}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                          i === activeImage
                            ? "border-[var(--cyan)]"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        aria-label={`Voir image ${i + 1}`}
                      >
                        <LazyImage src={src} alt="" fallbackText={String(i + 1)} fill />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ============ INFOS ============ */}
            <div className="lg:col-span-6">
              {/* Marque + categorie */}
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--cyan)]">
                {product.brand}
                {product.category_name ? ` - ${product.category_name}` : ""}
              </p>

              {/* Nom */}
              <h1 className="mt-2 text-2xl font-extrabold leading-tight text-[var(--fg-primary)] sm:text-3xl">
                {product.name}
              </h1>

              {/* Rating + ref */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--fg-muted)]">
                {(product.rating ?? 0) > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1 text-[var(--orange)]">
                      <StarIcon size={14} className="fill-current" />
                      <span className="font-semibold">
                        {product.rating?.toFixed(1)}
                      </span>
                      <span className="text-[var(--fg-muted)]">/ 5</span>
                    </span>
                    {product.review_count ? (
                      <span>{product.review_count} avis</span>
                    ) : null}
                    <span className="text-[var(--border-strong)]">|</span>
                  </>
                )}
                <span className="font-mono text-[10px]">
                  Ref. {product.sku}
                </span>
              </div>

              {/* Prix */}
              <div className="mt-6 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-extrabold text-[var(--cyan)] sm:text-4xl">
                  {formatAriary(finalPrice)}
                </span>
                {comparePrice && (
                  <span className="text-lg text-[var(--fg-muted)] line-through">
                    {formatAriary(comparePrice)}
                  </span>
                )}
                {discountPct && (
                  <span className="rounded-md bg-[var(--orange)] px-2 py-1 text-xs font-bold text-white">
                    -{discountPct}%
                  </span>
                )}
                {product.stock > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--success-green)]/15 px-2 py-1 text-xs font-bold text-[var(--success-green)]">
                    <CheckIcon size={12} />
                    En stock
                  </span>
                ) : (
                  <span className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-bold text-red-500">
                    Rupture
                  </span>
                )}
              </div>

              {/* Specs bullets (4 premieres) */}
              {attributeEntries.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {attributeEntries.map(([key, value]) => (
                    <li
                      key={key}
                      className="flex items-start gap-2 text-sm text-[var(--fg-secondary)]"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
                      <span>
                        <span className="font-semibold text-[var(--fg-primary)]">
                          {key}
                        </span>{" "}
                        : {String(value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Description courte */}
              {product.short_description && (
                <p className="mt-4 text-sm leading-relaxed text-[var(--fg-secondary)]">
                  {product.short_description}
                </p>
              )}

              {/* Selecteur quantite + CTA */}
              <div className="mt-6 flex flex-wrap items-stretch gap-3">
                {/* Quantite */}
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-12 w-12 items-center justify-center text-lg font-bold text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
                    aria-label="Diminuer quantite"
                  >
                    -
                  </button>
                  <span className="min-w-[2.5rem] text-center text-base font-bold text-[var(--fg-primary)]">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQty((q) => Math.min(product.stock || 1, q + 1))
                    }
                    className="flex h-12 w-12 items-center justify-center text-lg font-bold text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
                    aria-label="Augmenter quantite"
                  >
                    +
                  </button>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={product.stock <= 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--cyan)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[var(--navy-deep)] shadow-md transition-all hover:bg-[var(--cyan-hover)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CartIcon size={18} />
                  {added ? "Ajoute au panier" : "Ajouter au panier"}
                </button>

                {/* Favoris */}
                <FavoriteButton
                  product={product}
                  size={20}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-[var(--fg-secondary)] transition hover:border-[var(--orange)]/40 hover:text-[var(--orange)]"
                />
              </div>

              {/* Actions secondaires */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ShareProductButton productName={product.name} path={sharePath} />
              </div>

              {/* 3 Garanties */}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <TruckIcon size={16} className="shrink-0 text-[var(--success-green)]" />
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                    Livraison 24h
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <ShieldCheckIcon size={16} className="shrink-0 text-[var(--success-green)]" />
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                    Garantie 3 ans
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                  <RefreshIcon size={16} className="shrink-0 text-[var(--success-green)]" />
                  <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
                    Retour 30j
                  </span>
                </div>
              </div>

              {/* Usage tags */}
              {product.usage_tags && product.usage_tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.usage_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-[var(--cyan)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--cyan)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* TABS (Description / Specs / Avis / Compat)    */}
      {/* ============================================ */}
      <section className="bg-[var(--bg-app)]">
        <div className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-16">
          {/* Nav tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
            <TabButton
              active={activeTab === "description"}
              onClick={() => setActiveTab("description")}
              label="Description"
            />
            <TabButton
              active={activeTab === "specs"}
              onClick={() => setActiveTab("specs")}
              label="Specifications"
            />
            <TabButton
              active={activeTab === "avis"}
              onClick={() => setActiveTab("avis")}
              label={`Avis (${product.review_count || 0})`}
            />
            <TabButton
              active={activeTab === "compatibilite"}
              onClick={() => setActiveTab("compatibilite")}
              label="Compatibilite"
            />
          </div>

          {/* Contenu */}
          <div className="mt-6">
            {/* ===== DESCRIPTION ===== */}
            {activeTab === "description" && (
              <div className="max-w-3xl">
                {product.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-secondary)]">
                    {product.description}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">
                    Aucune description detaillee pour ce produit.
                  </p>
                )}
              </div>
            )}

            {/* ===== SPECS ===== */}
            {activeTab === "specs" && (
              <>
                {Object.keys(attributes).length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(attributes).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
                          {key}
                        </p>
                        <p className="mt-2 font-mono text-sm font-bold text-[var(--cyan)]">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">
                    Aucune specification technique disponible.
                  </p>
                )}
              </>
            )}

            {/* ===== AVIS ===== */}
            {activeTab === "avis" && (
              <div className="max-w-3xl">
                {(product.rating ?? 0) > 0 ? (
                  <div className="flex items-center gap-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                    <div className="text-center">
                      <p className="text-4xl font-extrabold text-[var(--orange)]">
                        {product.rating?.toFixed(1)}
                      </p>
                      <div className="mt-1 flex justify-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon
                            key={i}
                            size={14}
                            className={
                              i < Math.round(product.rating || 0)
                                ? "fill-current text-[var(--orange)]"
                                : "text-[var(--fg-muted)]/30"
                            }
                          />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-[var(--fg-muted)]">
                        {product.review_count || 0} avis
                      </p>
                    </div>
                    <div className="flex-1 text-sm text-[var(--fg-secondary)]">
                      <p>
                        Ce produit a recu une note moyenne de{" "}
                        <strong>{product.rating?.toFixed(1)}</strong> sur 5
                        basee sur{" "}
                        <strong>{product.review_count || 0} avis</strong>{" "}
                        clients.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">
                    Aucun avis pour le moment.
                  </p>
                )}
              </div>
            )}

            {/* ===== COMPATIBILITE ===== */}
            {activeTab === "compatibilite" && (
              <div className="max-w-3xl">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                  <div className="flex items-start gap-3">
                    <CpuIcon size={24} className="shrink-0 text-[var(--cyan)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--fg-primary)]">
                        Verification de compatibilite
                      </p>
                      <p className="mt-1 text-sm text-[var(--fg-secondary)]">
                        Pour verifier la compatibilite avec votre configuration
                        actuelle, utilisez notre assistant IA ou consultez les
                        specifications techniques ci-dessus.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          // Declencher l'ouverture du chat IA
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("open-chat", {
                                detail: {
                                  message: `Verifier la compatibilite de : ${product?.name}`,
                                },
                              })
                            );
                          }
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--cyan)] hover:underline"
                      >
                        <ZapIcon size={14} />
                        Demander a l&apos;IA
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* PRODUITS SIMILAIRES                           */}
      {/* ============================================ */}
      <SimilarProducts
        productId={product.id}
        categoryId={product.category_id}
      />
    </div>
  );
}

/* ============================================ */
/* SOUS-COMPOSANTS                                */
/* ============================================ */

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition ${
        active
          ? "border-[var(--cyan)] text-[var(--cyan)]"
          : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
      }`}
    >
      {label}
    </button>
  );
}
