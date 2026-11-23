"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { syncAccountState } from "@/lib/sync-account";
import { getHomePathForRole } from "@/lib/auth-routing";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginPopover() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

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
      setOpen(false); // Fermer le popover après succès
      router.push(getHomePathForRole(data.user.role));
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bouton déclencheur */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--fg-secondary)] transition-all hover:bg-[var(--bg-muted)] hover:text-[var(--cyan)]"
        title="Connexion"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {/* Popover formulaire */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 animate-scale-in rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900 z-50">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Connexion</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="vous@exemple.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Mot de passe</label>
              <PasswordInput
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2 text-sm">
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/google`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Continuer avec Google
            </a>
          </div>

          <div className="mt-4 text-center text-xs text-slate-500">
            Pas de compte ?{" "}
            <a href="/register" className="font-semibold text-cyan-600 hover:underline">
              S'inscrire
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
