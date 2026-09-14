"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";
import { useAuthStore } from "@/lib/store";
import { LogoIcon } from "@/components/ui/icons";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.register(form);
      if (!res.success || !res.data) {
        setError(res.error || "Erreur d'inscription");
        return;
      }

      const data = res.data as {
        user: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: string;
        };
        access_token: string;
        refresh_token: string;
      };

      void logActivity({ action: "register", category: "auth", message: "Inscription utilisateur" });
      setAuth(data.user, data.access_token, data.refresh_token);
      router.push("/");
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex">
            <LogoIcon size={48} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Inscription</h1>
          <p className="mt-1 text-sm text-slate-600">
            Creez votre compte L&apos;AMI
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Prenom
              </label>
              <input
                name="first_name"
                required
                value={form.first_name}
                onChange={handleChange}
                className="input-field"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nom
              </label>
              <input
                name="last_name"
                required
                value={form.last_name}
                onChange={handleChange}
                className="input-field"
                placeholder="Dupont"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              className="input-field"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Telephone (optionnel)
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="input-field"
              placeholder="+33 6 00 00 00 00"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              className="input-field"
              placeholder="Minimum 8 caracteres"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creation..." : "Creer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Deja un compte ?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
