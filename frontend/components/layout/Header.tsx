"use client";

import Link from "next/link";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";
import {
  LogoIcon, CartIcon, MenuIcon, HeartIcon, XIcon,
  CpuIcon, MonitorIcon, KeyboardIcon, MouseIcon,
  HeadphonesIcon, HardDriveIcon, ZapIcon, GamepadIcon,
  TagIcon, SparklesIcon, ChevronDownIcon,
} from "@/components/ui/icons";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SmartSearch from "@/components/search/SmartSearch";
import UserMenu from "@/components/layout/UserMenu";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SearchableProduct } from "@/lib/search";

// ---------------------------------------------------------------------------
// Définition des catégories du Mega Menu
// ---------------------------------------------------------------------------
const MEGA_MENU_CATEGORIES = [
  {
    title: "Composants",
    items: [
      { name: "Processeurs (CPU)", href: "/catalog?category=CPU", icon: CpuIcon },
      { name: "Cartes graphiques", href: "/catalog?category=GPU", icon: ZapIcon },
      { name: "Mémoires RAM", href: "/catalog?category=RAM", icon: HardDriveIcon },
      { name: "Stockage SSD/HDD", href: "/catalog?category=Stockage", icon: HardDriveIcon },
      { name: "Cartes mères", href: "/catalog?category=Carte mère", icon: CpuIcon },
      { name: "Alimentations", href: "/catalog?category=Alimentation", icon: ZapIcon },
    ],
  },
  {
    title: "Périphériques",
    items: [
      { name: "Écrans / Moniteurs", href: "/catalog?category=Écran", icon: MonitorIcon },
      { name: "Claviers", href: "/catalog?category=Clavier", icon: KeyboardIcon },
      { name: "Souris", href: "/catalog?category=Souris", icon: MouseIcon },
      { name: "Casques audio", href: "/catalog?category=Casque", icon: HeadphonesIcon },
      { name: "Webcams", href: "/catalog?category=Webcam", icon: MonitorIcon },
      { name: "Enceintes", href: "/catalog?category=Enceinte", icon: HeadphonesIcon },
    ],
  },
  {
    title: "Gaming & Configs",
    items: [
      { name: "PC Gaming", href: "/catalog?usage=gaming", icon: GamepadIcon },
      { name: "PC Bureautique", href: "/catalog?usage=bureautique", icon: MonitorIcon },
      { name: "PC Workstation", href: "/catalog?usage=creation", icon: CpuIcon },
      { name: "Accessoires Gaming", href: "/catalog?usage=gaming", icon: GamepadIcon },
      { name: "Streaming", href: "/catalog?usage=streaming", icon: MonitorIcon },
      { name: "Promotions", href: "/catalog?usage=promo", icon: TagIcon },
    ],
  },
];

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cartCount = useCartStore((s) => s.count());
  const favCount = useFavoritesStore((s) => s.count());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState<SearchableProduct[]>([]);
  const [mounted, setMounted] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [megaClosing, setMegaClosing] = useState(false);
  const megaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isShopUser = !user || user.role === "client";

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    api.listProducts({ limit: "80" }).then((res) => {
      if (res.success && res.data) setProducts(res.data as SearchableProduct[]);
    }).catch(() => {});
  }, []);

  // Fermeture intelligente du mega menu avec délai
  const handleMegaEnter = () => {
    if (megaTimeoutRef.current) clearTimeout(megaTimeoutRef.current);
    setMegaClosing(false);
    setMegaOpen(true);
  };

  const handleMegaLeave = () => {
    megaTimeoutRef.current = setTimeout(() => {
      setMegaClosing(true);
      setTimeout(() => setMegaOpen(false), 150);
    }, 120);
  };

  const showCartBadge = mounted && cartCount > 0;
  const showFavBadge = mounted && favCount > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] glass transition-colors duration-300">
      {/* Ligne supérieure - Navigation principale */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo + Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoIcon size={36} />
            <span className="text-xl font-bold tracking-tight text-[var(--fg-primary)]">L&apos;AMI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {/* Catalogue avec Mega Menu */}
            <div
              className="relative"
              onMouseEnter={handleMegaEnter}
              onMouseLeave={handleMegaLeave}
            >
              <button
                type="button"
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  megaOpen
                    ? "bg-[var(--bg-muted)] text-[var(--fg-accent)]"
                    : "text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg-accent)]"
                }`}
              >
                Catalogue
                <ChevronDownIcon
                  size={14}
                  className={`transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            <NavLink href="/catalog?usage=gaming">Gaming</NavLink>
            <NavLink href="/catalog?category=PC Complets">PC Complets</NavLink>
            <NavLink href="/tickets">Support</NavLink>
          </nav>
        </div>

        {/* Recherche */}
        <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
          <SmartSearch products={products} compact className="w-full max-w-md" placeholder="Rechercher (ex: rtx 4060, ryzen...)" />
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isShopUser && showFavBadge && (
            <Link href="/favorites" className="relative rounded-lg p-2 text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-red-500" title="Mes favoris">
              <HeartIcon size={22} filled className="text-red-500" />
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{favCount}</span>
            </Link>
          )}
          {isShopUser && (
            <Link href="/cart" className="relative rounded-lg p-2 text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-accent)]">
              <CartIcon size={22} />
              {showCartBadge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fg-accent)] text-[10px] font-bold text-white">{cartCount}</span>
              )}
            </Link>
          )}
          {isAuthenticated() ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)]">Connexion</Link>
              <Link href="/register" className="rounded-lg bg-[var(--fg-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 hover:shadow-md">Créer un compte</Link>
            </div>
          )}
          <button type="button" className="rounded-lg p-2 text-[var(--fg-secondary)] md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>

      {/* Mega Menu Dropdown */}
      {megaOpen && (
        <div
          className={`absolute left-0 right-0 top-full z-40 border-b border-[var(--border)] bg-[var(--bg-surface)] shadow-xl transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${
            megaClosing ? "translate-y-[-10px] opacity-0" : "translate-y-0 opacity-100"
          }`}
          onMouseEnter={handleMegaEnter}
          onMouseLeave={handleMegaLeave}
        >
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {MEGA_MENU_CATEGORIES.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--fg-accent)]">
                    {group.title}
                  </h3>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
                            onClick={() => setMegaOpen(false)}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--fg-muted)] transition group-hover:bg-[var(--fg-accent)] group-hover:text-white">
                              <Icon size={16} />
                            </span>
                            <span className="font-medium">{item.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bandeau promotionnel en bas du mega menu */}
            <div className="mt-8 grid gap-3 border-t border-[var(--border)] pt-6 sm:grid-cols-3 dark:border-zinc-800">
              <Link
                href="/catalog?usage=gaming"
                className="group flex items-center gap-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4 transition hover:from-purple-500/20 hover:to-blue-500/20"
                onClick={() => setMegaOpen(false)}
              >
                <SparklesIcon size={24} className="text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-sm font-semibold text-[var(--fg-primary)]">Nouveautés Gaming</p>
                  <p className="text-xs text-[var(--fg-secondary)]">Dernières sorties 2026</p>
                </div>
              </Link>
              <Link
                href="/catalog?usage=promo"
                className="group flex items-center gap-3 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 p-4 transition hover:from-red-500/20 hover:to-orange-500/20"
                onClick={() => setMegaOpen(false)}
              >
                <TagIcon size={24} className="text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-[var(--fg-primary)]">Promotions</p>
                  <p className="text-xs text-[var(--fg-secondary)]">Jusqu&apos;à -30%</p>
                </div>
              </Link>
              <Link
                href="/catalog?category=PC Complets"
                className="group flex items-center gap-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-4 transition hover:from-emerald-500/20 hover:to-teal-500/20"
                onClick={() => setMegaOpen(false)}
              >
                <MonitorIcon size={24} className="text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-[var(--fg-primary)]">PC Complets</p>
                  <p className="text-xs text-[var(--fg-secondary)]">Prêts à l&apos;emploi</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Menu Mobile */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] md:hidden dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-4 py-3">
            <SmartSearch products={products} className="mb-3" />
          </div>

          {/* Catégories mobiles accordéon */}
          <MobileAccordion title="Catalogue" defaultOpen>
            {MEGA_MENU_CATEGORIES.map((group) => (
              <div key={group.title} className="mb-3">
                <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-[var(--fg-accent)]">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <MobileNavLink key={item.name} href={item.href} onClick={() => setMobileOpen(false)}>
                    {item.name}
                  </MobileNavLink>
                ))}
              </div>
            ))}
          </MobileAccordion>

          <MobileNavLink href="/catalog?usage=gaming" onClick={() => setMobileOpen(false)}>Gaming</MobileNavLink>
          <MobileNavLink href="/catalog?category=PC Complets" onClick={() => setMobileOpen(false)}>PC Complets</MobileNavLink>
          <MobileNavLink href="/tickets" onClick={() => setMobileOpen(false)}>Support</MobileNavLink>
          {!isAuthenticated() && (
            <>
              <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>Connexion</MobileNavLink>
              <MobileNavLink href="/register" onClick={() => setMobileOpen(false)}>Créer un compte</MobileNavLink>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative rounded-lg px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-accent)]"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
    >
      {children}
    </Link>
  );
}

function MobileAccordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)] dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-[var(--fg-primary)]"
      >
        <span>{title}</span>
        <ChevronDownIcon size={16} className={`text-[var(--fg-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-2 pb-3">{children}</div>}
    </div>
  );
}
