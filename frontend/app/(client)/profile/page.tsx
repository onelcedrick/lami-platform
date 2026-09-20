"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface GeoRegion {
  code: string;
  name: string;
  province: string;
  cities: string[];
}

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: string;
  locale?: string;
  currency?: string;
  address?: {
    street: string;
    city: string;
    postal_code: string;
    region?: string;
    province?: string;
    country: string;
    country_code?: string;
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, setAuth, user, accessToken, refreshToken } =
    useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    locale: "fr-MG",
    currency: "MGA",
    street: "",
    city: "",
    postal_code: "",
    region: "",
    province: "",
    country: "Madagascar",
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
        const [profRes, geoRes] = await Promise.all([
          api.getProfile(),
          api.listRegions(),
        ]);
        if (profRes.success && profRes.data) {
          const p = profRes.data as Profile;
          setProfile(p);
          setForm({
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            phone: p.phone || "",
            locale: p.locale || "fr-MG",
            currency: p.currency || "MGA",
            street: p.address?.street || "",
            city: p.address?.city || "",
            postal_code: p.address?.postal_code || "",
            region: p.address?.region || "",
            province: p.address?.province || "Toamasina",
            country: p.address?.country || "Madagascar",
          });
        }
        if (geoRes.success && geoRes.data) {
          setRegions(geoRes.data as GeoRegion[]);
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAuthenticated, router]);

  const selectedRegion = regions.find((r) => r.name === form.region);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.updateProfile({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        locale: form.locale,
        currency: form.currency,
        address: {
          street: form.street,
          city: form.city,
          postal_code: form.postal_code,
          region: form.region,
          province: form.province || selectedRegion?.province || "Toamasina",
          country: form.country,
          country_code: "MG",
        },
      });
      if (res.success && res.data) {
        const p = res.data as Profile;
        setProfile(p);
        setMessage({ type: "ok", text: "Profil mis à jour avec succès" });
        if (user && accessToken && refreshToken) {
          setAuth(
            { ...user, first_name: p.first_name, last_name: p.last_name },
            accessToken,
            refreshToken
          );
        }
      } else {
        setMessage({ type: "err", text: res.error || "Erreur" });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Mon profil
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Informations personnelles et adresse de livraison (Madagascar)
        </p>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg px-4 py-2 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="card mt-6 space-y-6 p-6">
        {/* Identité */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Identité
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Prénom">
              <input
                className="input-field"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </Field>
            <Field label="Nom">
              <input
                className="input-field"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Email">
              <input
                className="input-field bg-slate-50 dark:bg-slate-800/50"
                value={profile?.email || ""}
                disabled
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Téléphone">
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+261 32 00 000 00"
              />
            </Field>
          </div>
        </div>

        {/* Préférences */}
        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Préférences
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Langue">
              <select
                className="input-field"
                value={form.locale}
                onChange={(e) => setForm({ ...form, locale: e.target.value })}
              >
                <option value="fr-MG">Français (Madagascar)</option>
                <option value="fr">Français</option>
                <option value="mg">Malagasy</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Devise">
              <select
                className="input-field"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="MGA">Ariary (MGA)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Adresse */}
        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Adresse de livraison
          </h2>

          <div className="mt-4">
            <Field label="Région">
              <select
                className="input-field"
                value={form.region}
                onChange={(e) => {
                  const reg = regions.find((r) => r.name === e.target.value);
                  setForm({
                    ...form,
                    region: e.target.value,
                    province: reg?.province || form.province,
                    city: "",
                  });
                }}
              >
                <option value="">Sélectionner une région</option>
                {regions.map((r) => (
                  <option key={r.code} value={r.name}>
                    {r.name} ({r.province})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Ville">
              {selectedRegion ? (
                <select
                  className="input-field"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                >
                  <option value="">Sélectionner</option>
                  {selectedRegion.cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input-field"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Toamasina"
                />
              )}
            </Field>
            <Field label="Code postal">
              <input
                className="input-field"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="501"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Rue / Quartier">
              <input
                className="input-field"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                placeholder="Lot II M 45 Bis, Ambalavao"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Pays">
              <input
                className="input-field bg-slate-50 dark:bg-slate-800/50"
                value="Madagascar"
                disabled
              />
            </Field>
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Petit wrapper pour uniformiser les labels */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}