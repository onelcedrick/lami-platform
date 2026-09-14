/**
 * Donnees GEO Madagascar - contexte L'AMI (Toamasina)
 * Source: memo Master + regions administratives MG
 */

export const COMPANY_GEO = {
  name: "L'AMI - Assistance et Maintenance Informatique",
  legalName: "L'AMI Informatique",
  description:
    "Plateforme e-commerce de composants PC et support technique assiste par IA, basee a Toamasina, Madagascar.",
  address: {
    streetAddress: "Toamasina",
    addressLocality: "Toamasina",
    addressRegion: "Haute Matsiatra",
    postalCode: "301",
    addressCountry: "MG",
  },
  geo: {
    latitude: -21.4536,
    longitude: 47.0858,
  },
  areaServed: "Madagascar",
  availableLanguage: ["fr", "mg", "en"],
  priceCurrency: ["MGA", "EUR"],
  telephone: "+261",
  url: "https://lami.mg",
};

export const SEO_DEFAULTS = {
  siteName: "L'AMI",
  titleTemplate: "%s | L'AMI - PC & Support IA Madagascar",
  defaultTitle:
    "L'AMI - E-commerce composants PC et support technique IA | Toamasina, Madagascar",
  description:
    "Achetez composants PC (CPU, GPU, RAM), configurez votre machine et obtenez un support technique intelligent. L'AMI, assistance informatique a Toamasina et partout a Madagascar.",
  locale: "fr_MG",
  alternateLocales: ["fr_FR", "en_US", "mg_MG"],
  keywords: [
    "composants PC Madagascar",
    "ordinateur Toamasina",
    "support technique IA",
    "carte graphique Madagascar",
    "configurateur PC",
    "L'AMI informatique",
    "reparation PC Toamasina",
    "e-commerce high-tech Madagascar",
  ],
};
