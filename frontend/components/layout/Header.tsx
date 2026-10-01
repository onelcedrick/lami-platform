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

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    api.listProducts({ limit: "80" }).then((res) => {
      if (res.success && res.data) setProducts(res.data as SearchableProduct[]);
    }).catch(() => {});
  }, []);

  const showCartBadge = mounted && cartCount > 0;
  const showFavBadge = mounted && favCount > 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] glass transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoIcon size={36} />
            <span className="text-xl font-bold tracking-tight text-[var(--fg-primary)]">L&apos;AMI</span>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            <NavLink href="/catalog">Catalogue</NavLink>
            <NavLink href="/catalog?usage=gaming">Gaming</NavLink>
            <NavLink href="/catalog?category=PC Complets">PC Complets</NavLink>
            <NavLink href="/tickets">Support</NavLink>
          </nav>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
          <SmartSearch products={products} compact className="w-full max-w-md" placeholder="Rechercher (ex: sams, ryzen...)" />
        </div>

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
            <MenuIcon size={22} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 md:hidden">
          <SmartSearch products={products} className="mb-3" />
          <nav className="flex flex-col gap-1">
            <MobileNavLink href="/catalog" onClick={() => setMobileOpen(false)}>Catalogue</MobileNavLink>
            <MobileNavLink href="/catalog?usage=gaming" onClick={() => setMobileOpen(false)}>Gaming</MobileNavLink>
            <MobileNavLink href="/tickets" onClick={() => setMobileOpen(false)}>Support</MobileNavLink>
            {!isAuthenticated() && (
              <>
                <MobileNavLink href="/login" onClick={() => setMobileOpen(false)}>Connexion</MobileNavLink>
                <MobileNavLink href="/register" onClick={() => setMobileOpen(false)}>Créer un compte</MobileNavLink>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-medium text-[var(--fg-secondary)] transition hover:text-[var(--fg-accent)]">{children}</Link>;
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return <Link href={href} onClick={onClick} className="rounded-md px-3 py-2 text-sm text-[var(--fg-secondary)] hover:bg-[var(--bg-muted)]">{children}</Link>;
}
