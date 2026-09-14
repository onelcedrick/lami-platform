"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import ScrollToTop from "@/components/ui/ScrollToTop";
import VisitorTracker from "@/components/analytics/VisitorTracker";

/** Préfixes de routes où l'on masque l'habillage boutique */
const HIDE_CHROME_PREFIXES = ["/admin", "/technician"];

export default function ChromeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome =
    !!pathname && HIDE_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  // Espaces admin / technicien : layout autonome (sidebar dédiée)
  if (hideChrome) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Site boutique classique
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
      <ScrollToTop />
      <VisitorTracker />
    </>
  );
}