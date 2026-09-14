"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogoIcon,
  CpuIcon,
  TicketIcon,
  CartIcon,
  UserIcon,
  StarIcon,
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

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <LogoIcon size={28} />
        <span className="font-bold text-slate-900">Admin</span>
      </div>
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
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          Retour au site
        </Link>
      </div>
    </aside>
  );
}
