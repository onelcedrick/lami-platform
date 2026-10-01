"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";
import { useAuthStore } from "@/lib/store";
import { LogoIcon } from "@/components/ui/icons";
import { syncAccountState } from "@/lib/sync-account";
import { getHomePathForRole } from "@/lib/auth-routing";
import AnimatedSection from "@/components/ui/AnimatedSection";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login({ email, password });
      if (!res.success || !res.data) {
        setError(res.error || "Email ou mot de passe incorrect");
        return;
      }

      const data = res.data as {
        user: { id: string; email: string; first_name: string; last_name: string; role: string };
        access_token: string;
        refresh_token: string;
      };

      setAuth(data.user, data.access_token, data.refresh_token);
      void syncAccountState();
      void logActivity({ action: "login", category: "auth", message: "Connexion utilisateur" });
      router.push(getHomePathForRole(data.user.role));
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <AnimatedSection className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-[var(--bg-surface)] p-3 shadow-sm dark:border dark:border-[var(--border)]">
            <LogoIcon size={48} />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-[var(--fg-primary)]">Connexion</h1>
          <p className="mt-2 text-sm text-[var(--fg-secondary)]">Accédez à votre espace client L&apos;AMI</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-8">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">Adresse email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-app)] px-4 py-2.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] transition focus:border-[var(--fg-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--fg-accent)]/20 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="vous@exemple.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--fg-secondary)]">Mot de passe</label>
            <PasswordInput
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base disabled:opacity-70">
            {loading ? "Connexion en cours..." : "Se connecter"}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--bg-surface)] px-3 text-[var(--fg-muted)]">ou</span>
            </div>
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/google`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm font-medium text-[var(--fg-primary)] transition hover:bg-[var(--bg-muted)] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </a>
        </form>

        <p className="mt-8 text-center text-sm text-[var(--fg-secondary)]">
          Pas encore de compte ?{" "}
          <Link href="/register" className="font-semibold text-[var(--fg-accent)] transition hover:underline">
            Créer un compte gratuitement
          </Link>
        </p>
      </AnimatedSection>
    </div>
  );
}
