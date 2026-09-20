"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { getHomePathForRole, isAdminRole } from "@/lib/auth-routing";
import AdminSidebar from "@/components/layout/AdminSidebar";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (!isAdminRole(user?.role)) {
      router.replace(getHomePathForRole(user?.role));
      return;
    }
    setAllowed(true);
  }, [user, isAuthenticated, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Vérification des droits...
      </div>
    );
  }

  return (
    <SidebarLayout sidebar={<AdminSidebar />} storageKey="lami-admin-sidebar-open">
      {children}
    </SidebarLayout>
  );
}