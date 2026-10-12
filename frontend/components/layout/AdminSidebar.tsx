"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import SidebarSection from "./SidebarSection";
import SidebarItem from "./SidebarItem";
import DynamicLogo from "@/components/ui/DynamicLogo";
import {
  LogoIcon,
  LayoutDashboardIcon,
  ShoppingBagIcon,
  LifeBuoyIcon,
  PackageIcon,
  FolderIcon,
  TagIcon,
  UsersIcon,
  UserCogIcon,
  EyeIcon,
  BarChartIcon,
  FileTextIcon,
  SettingsIcon,
  StoreIcon,
  LogoutIcon,
} from "@/components/ui/icons";

export default function AdminSidebar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [counts, setCounts] = useState({
    pendingOrders: 0,
    openTickets: 0,
  });

  // Charger les compteurs
  useEffect(() => {
    async function loadCounts() {
      try {
        const [ordersRes, ticketsRes] = await Promise.all([
          api.listOrders({ limit: 100 }),
          api.listTickets({ limit: 100 }),
        ]);

        const pendingOrders =
          ordersRes.success && ordersRes.data
            ? (ordersRes.data as Array<{ status: string }>).filter(
                (o) => o.status === "pending" || o.status === "confirmed"
              ).length
            : 0;

        const openTickets =
          ticketsRes.success && ticketsRes.data
            ? (ticketsRes.data as Array<{ status: string }>).filter(
                (t) => t.status === "open" || t.status === "in_progress"
              ).length
            : 0;

        setCounts({ pendingOrders, openTickets });
      } catch {
        // silent
      }
    }
    loadCounts();
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() ||
      user.email[0].toUpperCase()
    : "A";

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-surface)]">
      {/* ============================================ */}
      {/* Header - Branding                            */}
      {/* ============================================ */}
      <div className="border-b border-[var(--border)] px-4 py-4">
        <Link href="/admin/dashboard" className="block">
          <DynamicLogo variant="icon" size={36} className="h-10 w-auto" />
        </Link>
      </div>

      {/* ============================================ */}
      {/* Navigation                                   */}
      {/* ============================================ */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* PRINCIPAL */}
        <SidebarSection title="Principal">
          <SidebarItem
            href="/admin/dashboard"
            label="Dashboard"
            icon={<LayoutDashboardIcon size={18} />}
            exact
          />
          <SidebarItem
            href="/admin/orders"
            label="Commandes"
            icon={<ShoppingBagIcon size={18} />}
            badge={counts.pendingOrders || undefined}
            badgeColor="warning"
          />
          <SidebarItem
            href="/admin/tickets"
            label="Tickets"
            icon={<LifeBuoyIcon size={18} />}
            badge={counts.openTickets || undefined}
            badgeColor={counts.openTickets > 5 ? "danger" : "warning"}
          />
        </SidebarSection>

        {/* CATALOGUE */}
        <SidebarSection title="Catalogue">
          <SidebarItem
            href="/admin/products"
            label="Produits"
            icon={<PackageIcon size={18} />}
          />
          <SidebarItem
            href="/admin/categories"
            label="Catégories"
            icon={<FolderIcon size={18} />}
          />
          <SidebarItem
            href="/admin/discounts"
            label="Promotions"
            icon={<TagIcon size={18} />}
          />
        </SidebarSection>

        {/* UTILISATEURS */}
        <SidebarSection title="Utilisateurs">
          <SidebarItem
            href="/admin/users"
            label="Clients"
            icon={<UsersIcon size={18} />}
          />
          <SidebarItem
            href="/admin/technicians"
            label="Techniciens"
            icon={<UserCogIcon size={18} />}
          />
        </SidebarSection>

        {/* ANALYSE */}
        <SidebarSection title="Analyse" defaultOpen={false}>
          <SidebarItem
            href="/admin/analytics"
            label="Visiteurs"
            icon={<EyeIcon size={18} />}
          />
          <SidebarItem
            href="/admin/reports"
            label="Rapports CA"
            icon={<BarChartIcon size={18} />}
          />
          <SidebarItem
            href="/admin/logs"
            label="Journal"
            icon={<FileTextIcon size={18} />}
          />
        </SidebarSection>

        {/* SYSTÈME */}
        <SidebarSection title="Système" defaultOpen={false}>
          <SidebarItem
            href="/admin/preferences"
            label="Préférences"
            icon={<SettingsIcon size={18} />}
          />
          <SidebarItem
            href="/admin/settings"
            label="Boutique"
            icon={<StoreIcon size={18} />}
          />
        </SidebarSection>
      </nav>

      {/* ============================================ */}
      {/* Footer - User                                */}
      {/* ============================================ */}
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-muted)] p-2.5">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white">
            {initials}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--fg-primary)]">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : "Administrateur"}
            </p>
            <p className="truncate text-[10px] text-[var(--fg-muted)]">
              {user?.email || "admin@lami.mg"}
            </p>
          </div>

          {/* Bouton déconnexion */}
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg p-1.5 text-[var(--fg-muted)] transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Déconnexion"
          >
            <LogoutIcon size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
