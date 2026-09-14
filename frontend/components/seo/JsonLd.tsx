import { COMPANY_GEO } from "@/lib/geo";

/** Donnees structurees Schema.org pour SEO + GEO local (LocalBusiness) */
export default function JsonLd() {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "ComputerStore",
    name: COMPANY_GEO.name,
    description: COMPANY_GEO.description,
    url: COMPANY_GEO.url,
    telephone: COMPANY_GEO.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY_GEO.address.streetAddress,
      addressLocality: COMPANY_GEO.address.addressLocality,
      addressRegion: COMPANY_GEO.address.addressRegion,
      postalCode: COMPANY_GEO.address.postalCode,
      addressCountry: COMPANY_GEO.address.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: COMPANY_GEO.geo.latitude,
      longitude: COMPANY_GEO.geo.longitude,
    },
    areaServed: {
      "@type": "Country",
      name: "Madagascar",
    },
    availableLanguage: COMPANY_GEO.availableLanguage,
    priceRange: "$$",
    currenciesAccepted: COMPANY_GEO.priceCurrency.join(", "),
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMPANY_GEO.legalName,
    url: COMPANY_GEO.url,
    logo: `${COMPANY_GEO.url}/icons/logo.svg`,
    address: localBusiness.address,
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "L'AMI",
    url: COMPANY_GEO.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${COMPANY_GEO.url}/catalog?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
    inLanguage: ["fr-MG", "fr", "mg", "en"],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
