/** JSON-LD Product pour pages catalogue (SEO e-commerce) */
export function productJsonLd(product: {
  name: string;
  description?: string;
  sku?: string;
  brand?: string;
  price: number;
  currency?: string;
  stock?: number;
  images?: string[];
  url?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: product.images,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency || "MGA",
      availability:
        (product.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: product.url,
      seller: {
        "@type": "Organization",
        name: "L'AMI",
      },
      areaServed: "MG",
    },
  };
}
