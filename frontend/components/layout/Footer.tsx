import Link from "next/link";
import { LogoIcon } from "@/components/ui/icons";

const FOOTER_LINKS = [
  {
    title: "Boutique",
    links: [
      { name: "Catalogue", href: "/catalog" },
      { name: "PC Complets", href: "/catalog?category=PC Complets" },
      { name: "Promotions", href: "/catalog?usage=promo" },
    ],
  },
  {
    title: "Support",
    links: [
      { name: "Tickets", href: "/tickets" },
      { name: "FAQ", href: "/faq" },
      { name: "Garantie", href: "/garantie" },
    ],
  },
  {
    title: "Légal",
    links: [
      { name: "Conditions générales", href: "/cgv" },
      { name: "Politique de confidentialité", href: "/confidentialite" },
      { name: "Mentions légales", href: "/mentions-legales" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Marque */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoIcon size={32} />
              <span className="text-lg font-bold tracking-tight text-[var(--fg-primary)]">
                L&apos;AMI Informatique
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--fg-secondary)]">
              Votre partenaire de confiance pour le matériel informatique, le dépannage et les configurations sur mesure à Toamasina, Madagascar.
            </p>
            <div className="mt-6 flex gap-4">
              {/* Placeholder pour réseaux sociaux (SVG simples) */}
              <a href="#" className="text-[var(--fg-muted)] transition hover:text-[var(--fg-accent)]" aria-label="Facebook">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="#" className="text-[var(--fg-muted)] transition hover:text-[var(--fg-accent)]" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            </div>
          </div>

          {/* Liens */}
          {FOOTER_LINKS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--fg-primary)]">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--fg-secondary)] transition hover:text-[var(--fg-accent)]"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bas de page */}
        <div className="mt-12 border-t border-[var(--border)] pt-8 dark:border-zinc-800">
          <p className="text-center text-xs text-[var(--fg-muted)]">
            © {new Date().getFullYear()} L&apos;AMI Informatique. Tous droits réservés. Conçu avec passion à Toamasina.
          </p>
        </div>
      </div>
    </footer>
  );
}
