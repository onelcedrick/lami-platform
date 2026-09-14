"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import AdminSidebar from "@/components/layout/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    if (!isAdmin()) {
      router.replace("/");
    }
  }, [user, isAuthenticated, isAdmin, router]);

  if (!isAuthenticated() || !isAdmin()) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Verification des droits...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
