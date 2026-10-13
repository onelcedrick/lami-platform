"use client";

import Link from "next/link";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";
import { LogoIcon, CartIcon, MenuIcon, HeartIcon } from "@/components/ui/icons";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SmartSearch from "@/components/search/SmartSearch";
import UserMenu from "@/components/layout/UserMenu";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SearchableProduct } from "@/lib/search";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cartCount = useCartStore((s) => s.count());
  const favCount = useFavoritesStore((s) => s.count());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState<SearchableProduct[]>([]);
  const [mounted, setMounted] = useState(false);

  const isShopUser = !user || user.role === "client";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .listProducts({ limit: "80" })
      .then((res) => {
        if (res.success && res.data) setProducts(res.data as SearchableProduct[]);
      })
      .catch(() => {});
  }, []);

  const showCartBadge = mounted && cartCount > 0;
  const showFavBadge = mounted && favCount > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--bg-surface)]/95 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 xl:px-16">
        {/* ============================================ */}
        {/* GAUCHE : Logo + Navigation                    */}
        {/* ============================================ */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoIcon size={36} />
            <span className="text-xl font-bold tracking-tight text-[var(--fg-primary)]">
              L&apos;AMI
            </span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <NavLink href="/catalog">Catalogue</NavLink>
            <NavLink href="/catalog?usage=gaming">Gaming</NavLink>
            <NavLink href="/catalog?category=PC Complets">PC Complets</NavLink>
            <NavLink href="/tickets">Support</NavLink>
          </nav>
        </div>

        {/* ============================================ */}
        {/* CENTRE : Recherche                            */}
        {/* ============================================ */}
        <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
          <SmartSearch
            products={products}
            compact
            className="w-full max-w-md"
            placeholder="Rechercher (ex: sams, ryzen...)"
          />
        </div>

        {/* ============================================ */}
        {/* DROITE : Panier pilule + Icônes               */}
        {/* ============================================ */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Panier - Bouton pilule orange (style TechStore) */}
          {isShopUser && (
            <Link
              href="/cart"
              className="group flex items-center gap-2 rounded-full bg-[var(--orange)] px-3.5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--orange-hover)] hover:shadow-md active:scale-95 sm:px-4"
            >
              <CartIcon size={18} className="transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Panier</span>
              {showCartBadge && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/25 px-1.5 text-[11px] font-extrabold">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {/* Favoris - Icône outline (avec badge rouge subtil) */}
          {isShopUser && (
            <Link
              href="/favorites"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg-secondary)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--orange)]"
              title="Mes favoris"
            >
              <HeartIcon size={20} />
              {showFavBadge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--orange)] px-1 text-[9px] font-bold text-white">
                  {favCount > 99 ? "99+" : favCount}
                </span>
              )}
            </Link>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Compte / UserMenu */}
          {isAuthenticated() ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg-secondary)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--cyan)]"
                title="Connexion"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            </div>
          )}

          {/* Menu mobile */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <MenuIcon size={22} />
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* MENU MOBILE                                   */}
      {/* ============================================ */}
      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 md:hidden">
          <SmartSearch products={products} className="mb-3" />
          <nav className="flex flex-col gap-1">
            <MobileNavLink href="/catalog" onClick={() => setMobileOpen(false)}>
              Catalogue
            </MobileNavLink>
            <MobileNavLink
              href="/catalog?usage=gaming"
              onClick={() => setMobileOpen(false)}
            >
              Gaming
            </MobileNavLink>
            <MobileNavLink href="/tickets" onClick={() => setMobileOpen(false)}>
              Support
            </MobileNavLink>
            {!isAuthenticated() && (
              <>
                <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>
                  Connexion
                </MobileNavLink>
                <MobileNavLink
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                >
                  Creer un compte
                </MobileNavLink>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

/* ============================================ */
/* SOUS-COMPOSANTS                                */
/* ============================================ */

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:text-[var(--fg-primary)]"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-primary)]"
    >
      {children}
    </Link>
  );
}
