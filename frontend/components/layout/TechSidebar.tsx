"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { LogoIcon, TicketIcon, CpuIcon, LogoutIcon } from "@/components/ui/icons";

const links = [
  { href: "/technician/dashboard", label: "Dashboard", icon: CpuIcon },
  { href: "/technician/tickets", label: "Mes tickets", icon: TicketIcon },
];

export default function TechSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();              // vide le store + tokens + panier + favoris
    router.push("/login"); // redirige
    router.refresh();      // vide les caches React
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
        <LogoIcon size={28} />
        <span className="font-bold text-slate-900 dark:text-slate-100">
          Technicien
        </span>
      </div>

      {/* Info user */}
      <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800/60">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {user?.first_name} {user?.last_name}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {user?.email}
        </p>
        <span className="mt-1.5 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Technicien
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Déconnexion */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <LogoutIcon size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}