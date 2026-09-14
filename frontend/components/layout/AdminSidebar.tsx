"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  LogoIcon,
  CpuIcon,
  TicketIcon,
  CartIcon,
  UserIcon,
  StarIcon,
  LogoutIcon,
} from "@/components/ui/icons";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: CpuIcon },
  { href: "/admin/products", label: "Produits", icon: CpuIcon },
  { href: "/admin/discounts", label: "Promotions", icon: StarIcon },
  { href: "/admin/orders", label: "Commandes", icon: CartIcon },
  { href: "/admin/tickets", label: "Tickets", icon: TicketIcon },
  { href: "/admin/users", label: "Utilisateurs", icon: UserIcon },
  { href: "/admin/analytics", label: "Visiteurs", icon: CpuIcon },
  { href: "/admin/reports", label: "Rapports CA", icon: CartIcon },
  { href: "/admin/settings", label: "Boutique", icon: CpuIcon },
  { href: "/admin/logs", label: "Journal", icon: TicketIcon },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
        <LogoIcon size={28} />
        <span className="font-bold text-slate-900 dark:text-slate-100">
          Admin
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

      {/* Footer */}
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