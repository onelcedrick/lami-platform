"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { LogoutIcon } from "@/components/ui/icons";
import Avatar from "@/components/ui/Avatar";

export default function UserMenu() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!isAuthenticated() || !user) return null;

  const roleLabel =
    user.role === "admin" || user.role === "super_admin"
      ? "Admin"
      : user.role === "technician"
        ? "Technicien"
        : "Client";

  const roleColor =
    user.role === "admin" || user.role === "super_admin"
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : user.role === "technician"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 py-1.5 pr-3 text-sm transition hover:border-primary-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700"
      >
        {/* ✅ Avatar du user dans le bouton */}
        <Avatar
          firstName={user.first_name}
          lastName={user.last_name}
          email={user.email}
          size="sm"
          ring
        />
        <span className="hidden font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {user.first_name}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 animate-scale-in rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {/* Header du menu */}
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-3 dark:from-slate-800 dark:to-slate-800/50">
            <div className="flex items-center gap-3">
              {/* ✅ Avatar plus grand dans le header du menu */}
              <Avatar
                firstName={user.first_name}
                lastName={user.last_name}
                email={user.email}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {user.first_name} {user.last_name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
            </div>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleColor}`}
            >
              {roleLabel}
            </span>
          </div>

          {/* Liens */}
          <div className="mt-2 space-y-0.5">
            <MenuLink href="/profile" onClick={() => setOpen(false)}>
              Mon profil
            </MenuLink>
            <MenuLink href="/orders" onClick={() => setOpen(false)}>
              Mes commandes
            </MenuLink>
            <MenuLink href="/tickets" onClick={() => setOpen(false)}>
              Mes tickets
            </MenuLink>

            {user.role === "technician" && (
              <MenuLink
                href="/technician/dashboard"
                onClick={() => setOpen(false)}
                highlight
              >
                Espace technicien
              </MenuLink>
            )}

            {(user.role === "admin" || user.role === "super_admin") && (
              <MenuLink
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                highlight
              >
                Administration
              </MenuLink>
            )}
          </div>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogoutIcon size={16} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
        highlight
          ? "bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 dark:hover:bg-primary-950/60"
          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}