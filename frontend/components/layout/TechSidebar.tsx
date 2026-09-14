"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoIcon, TicketIcon, CpuIcon } from "@/components/ui/icons";

const links = [
  { href: "/technician/dashboard", label: "Dashboard", icon: CpuIcon },
  { href: "/technician/tickets", label: "Mes tickets", icon: TicketIcon },
];

export default function TechSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <LogoIcon size={28} />
        <span className="font-bold text-slate-900">Technicien</span>
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
