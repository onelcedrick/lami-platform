"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { getHomePathForRole } from "@/lib/auth-routing";
import TechSidebar from "@/components/layout/TechSidebar";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default function TechnicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    const role = user?.role;
    const ok =
      role === "technician" || role === "admin" || role === "super_admin";
    if (!ok) {
      router.replace(getHomePathForRole(role));
      return;
    }
    setAllowed(true);
  }, [user, accessToken, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Vérification des droits...
      </div>
    );
  }

  return (
    <SidebarLayout sidebar={<TechSidebar />} storageKey="lami-tech-sidebar-open">
      {children}
    </SidebarLayout>
  );
}