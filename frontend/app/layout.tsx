import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import JsonLd from "@/components/seo/JsonLd";
import ThemeProvider from "@/components/providers/ThemeProvider";
import ScrollToTop from "@/components/ui/ScrollToTop";
import VisitorTracker from "@/components/analytics/VisitorTracker";
import { SEO_DEFAULTS } from "@/lib/geo";
import AccountSyncProvider from "@/components/providers/AccountSyncProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lami.mg"),
  title: {
    default: SEO_DEFAULTS.defaultTitle,
    template: SEO_DEFAULTS.titleTemplate,
  },
  description: SEO_DEFAULTS.description,
  keywords: SEO_DEFAULTS.keywords,
  authors: [{ name: "L'AMI Informatique" }],
  creator: "L'AMI",
  publisher: "L'AMI - Toamasina, Madagascar",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: SEO_DEFAULTS.locale,
    alternateLocale: SEO_DEFAULTS.alternateLocales,
    siteName: SEO_DEFAULTS.siteName,
    title: SEO_DEFAULTS.defaultTitle,
    description: SEO_DEFAULTS.description,
    url: "https://lami.mg",
  },
  twitter: {
    card: "summary_large_image",
    title: SEO_DEFAULTS.defaultTitle,
    description: SEO_DEFAULTS.description,
  },
  alternates: {
    canonical: "https://lami.mg",
    languages: {
      "fr-MG": "https://lami.mg",
      fr: "https://lami.mg/fr",
      mg: "https://lami.mg/mg",
      en: "https://lami.mg/en",
    },
  },
  other: {
    "geo.region": "MG-Toamasina",
    "geo.placename": "Toamasina",
    "geo.position": "-21.4536;47.0858",
    ICBM: "-21.4536, 47.0858",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-MG" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('lami-theme')||'{}').state?.theme;if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head><body className="flex min-h-screen flex-col antialiased">
  <ThemeProvider>
    <AccountSyncProvider>
      <JsonLd />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
      <ScrollToTop />
      <VisitorTracker />
    </AccountSyncProvider>
  </ThemeProvider>
</body>
    </html>
  );
}
