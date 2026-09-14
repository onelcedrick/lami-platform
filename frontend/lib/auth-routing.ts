// frontend/lib/auth-routing.ts
// Helper unique pour toute la logique de rôle côté frontend.

export type Role = "client" | "technician" | "admin" | "super_admin";

/** Route d'accueil selon le rôle */
export function getHomePathForRole(role: string | undefined | null): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin/dashboard";
    case "technician":
      return "/technician/dashboard";
    case "client":
    default:
      return "/";
  }
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "super_admin";
}

export function isTechnicianRole(role: string | undefined | null): boolean {
  return role === "technician";
}

export function isClientRole(role: string | undefined | null): boolean {
  return !role || role === "client";
}

/** Un admin/technicien ne doit pas voir la boutique */
export function canAccessShop(role: string | undefined | null): boolean {
  return isClientRole(role);
}

/** Un admin/super_admin ne doit pas voir l'espace technicien */
export function canAccessTechSpace(role: string | undefined | null): boolean {
  return isTechnicianRole(role);
}

/** Un technicien ne doit pas voir l'espace admin */
export function canAccessAdminSpace(role: string | undefined | null): boolean {
  return isAdminRole(role);
}