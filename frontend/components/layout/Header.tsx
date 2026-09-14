"use client";

import Link from "next/link";
import { useAuthStore, useCartStore, useFavoritesStore } from "@/lib/store";
import {
  LogoIcon,
  CartIcon,
  UserIcon,
  MenuIcon,
  LogoutIcon,
  HeartIcon,
} from "@/components/ui/icons";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SmartSearch from "@/components/search/SmartSearch";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SearchableProduct } from "@/lib/search";

export default function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const cartCount = useCartStore((s) => s.count());
  const favCount = useFavoritesStore((s) => s.count());
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState<SearchableProduct[]>([]);

  // Évite hydration mismatch : localStorage (panier/favoris) n'existe que côté client
  const [mounted, setMounted] = useState(false);

  // Masque les éléments boutique pour les rôles admin / technicien
  const isShopUser = !user || user.role === "client";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .listProducts({ limit: "80" })
      .then((res) => {
        if (res.success && res.data) {
          setProducts(res.data as SearchableProduct[]);
        }
      })
      .catch(() => {});
  }, []);

  const showCartBadge = mounted && cartCount > 0;
  const showFavBadge = mounted && favCount > 0;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6 lg:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoIcon size={36} />
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              L&apos;AMI
            </span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <Link
              href="/catalog"
              className="text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              Catalogue
            </Link>
            <Link
              href="/catalog?usage=gaming"
              className="text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              Gaming
            </Link>
            <Link
              href="/catalog?category=PC Complets"
              className="text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              PC Complets
            </Link>
            <Link
              href="/tickets"
              className="text-sm font-medium text-slate-600 transition hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
            >
              Support
            </Link>
          </nav>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
          <SmartSearch
            products={products}
            compact
            className="w-full max-w-md"
            placeholder="Rechercher (ex: sams, ryzen...)"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />

          {/* Favoris — visible uniquement pour les clients */}
          {isShopUser && showFavBadge && (
            <Link
              href="/favorites"
              className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-red-500 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Mes favoris"
            >
              <HeartIcon size={22} filled className="text-red-500" />
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {favCount}
              </span>
            </Link>
          )}

          {/* Panier — visible uniquement pour les clients */}
          {isShopUser && (
            <Link
              href="/cart"
              className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-primary-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CartIcon size={22} />
              {showCartBadge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated() ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <UserIcon size={22} />
                <span className="hidden text-sm font-medium sm:inline">
                  {user?.first_name}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mon profil
                  </Link>
                  <Link
                    href="/orders"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mes commandes
                  </Link>
                  <Link
                    href="/tickets"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mes tickets
                  </Link>

                  {/* Espace technicien — uniquement pour le rôle technician */}
                  {user?.role === "technician" && (
                    <Link
                      href="/technician/dashboard"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => setMenuOpen(false)}
                    >
                      Espace technicien
                    </Link>
                  )}

                  {/* Administration — uniquement pour admin / super_admin */}
                  {(user?.role === "admin" || user?.role === "super_admin") && (
                    <Link
                      href="/admin/dashboard"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => setMenuOpen(false)}
                    >
                      Administration
                    </Link>
                  )}

                  <hr className="my-1 border-slate-100 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <LogoutIcon size={16} />
                    Deconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-secondary text-sm">
                Connexion
              </Link>
              {/* <Link href="/register" className="btn-primary text-sm">
                Inscription
              </Link> */}
            </div>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 dark:text-slate-300 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <MenuIcon size={22} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 md:hidden">
          <SmartSearch products={products} className="mb-3" />
          <nav className="flex flex-col gap-1">
            <Link
              href="/catalog"
              className="rounded-md px-3 py-2 text-sm dark:text-slate-200"
              onClick={() => setMobileOpen(false)}
            >
              Catalogue
            </Link>
            <Link
              href="/catalog?usage=gaming"
              className="rounded-md px-3 py-2 text-sm dark:text-slate-200"
              onClick={() => setMobileOpen(false)}
            >
              Gaming
            </Link>
            <Link
              href="/tickets"
              className="rounded-md px-3 py-2 text-sm dark:text-slate-200"
              onClick={() => setMobileOpen(false)}
            >
              Support
            </Link>
            {!isAuthenticated() && (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-sm dark:text-slate-200"
                  onClick={() => setMobileOpen(false)}
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="rounded-md px-3 py-2 text-sm dark:text-slate-200"
                  onClick={() => setMobileOpen(false)}
                >
                  Inscription
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
