"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import {
  getHomePathForRole,
  isAdminRole,
  isTechnicianRole,
} from "@/lib/auth-routing";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Le StoreHydrator (dans le layout racine) garantit que user est déjà hydraté.
    if (!user) {
      // Non connecté : la boutique est publique, on laisse passer
      setReady(true);
      return;
    }
    if (isAdminRole(user.role) || isTechnicianRole(user.role)) {
      router.replace(getHomePathForRole(user.role));
      return;
    }
    setReady(true);
  }, [user, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Redirection...
      </div>
    );
  }

  return <>{children}</>;
}