"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { LogoIcon } from "@/components/ui/icons";
import { getHomePathForRole } from "@/lib/auth-routing";

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState("");

  useEffect(() => {
    const oauthError = params.get("oauth_error");
    if (oauthError) {
      setError(oauthError);
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Tokens manquants dans le callback OAuth");
      return;
    }

    // Stocker temporairement pour que api.profile utilise le token
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);

    api
      .profile()
      .then((res) => {
        if (res.success && res.data) {
          const user = res.data as {
            id: string;
            email: string;
            first_name: string;
            last_name: string;
            role: string;
          };
          setAuth(user, accessToken, refreshToken);
          router.replace(getHomePathForRole(user.role));
        } else {
          // Fallback: decoder minimal depuis le token n'est pas ideal;
          // rediriger vers login si profil indisponible
          setAuth(
            {
              id: "",
              email: "",
              first_name: "Utilisateur",
              last_name: "Google",
              role: "client",
            },
            accessToken,
            refreshToken
          );
          router.replace(getHomePathForRole("client"));
        }
      })
      .catch(() => {
        setError("Impossible de recuperer le profil apres connexion Google");
      });
  }, [params, router, setAuth]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <LogoIcon size={48} />
        <p className="mt-4 text-red-600">{error}</p>
        <a href="/login" className="btn-primary mt-6">
          Retour a la connexion
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <LogoIcon size={48} />
      <p className="mt-4 text-slate-600">Connexion Google en cours...</p>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
          Chargement...
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
