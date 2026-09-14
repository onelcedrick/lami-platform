"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import TechSidebar from "@/components/layout/TechSidebar";

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const role = user?.role;
    if (role !== "technician" && role !== "admin" && role !== "super_admin") {
      router.replace("/");
    }
  }, [user, isAuthenticated, router]);

  const role = user?.role;
  const allowed =
    isAuthenticated() &&
    (role === "technician" || role === "admin" || role === "super_admin");

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Verification des droits...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <TechSidebar />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
