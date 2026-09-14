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
  const { isAuthenticated, setAuth, user, accessToken, refreshToken } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
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
        // silent
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
    setMessage("");
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
        setMessage("Profil mis a jour");
        if (user && accessToken && refreshToken) {
          setAuth(
            {
              ...user,
              first_name: p.first_name,
              last_name: p.last_name,
            },
            accessToken,
            refreshToken
          );
        }
      } else {
        setMessage(res.error || "Erreur");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-400">
        Chargement du profil...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>
      <p className="mt-1 text-slate-600">
        Informations personnelles et adresse de livraison (Madagascar)
      </p>

      {message && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-800">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="card mt-6 space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Prenom
            </label>
            <input
              className="input-field"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Nom
            </label>
            <input
              className="input-field"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            className="input-field bg-slate-50"
            value={profile?.email || ""}
            disabled
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Telephone
          </label>
          <input
            className="input-field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+261 32 00 000 00"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Langue
            </label>
            <select
              className="input-field"
              value={form.locale}
              onChange={(e) => setForm({ ...form, locale: e.target.value })}
            >
              <option value="fr-MG">Francais (Madagascar)</option>
              <option value="fr">Francais</option>
              <option value="mg">Malagasy</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Devise
            </label>
            <select
              className="input-field"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="MGA">Ariary (MGA)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Adresse de livraison
        </h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Region
          </label>
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
            <option value="">Selectionner une region</option>
            {regions.map((r) => (
              <option key={r.code} value={r.name}>
                {r.name} ({r.province})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Ville
            </label>
            {selectedRegion ? (
              <select
                className="input-field"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              >
                <option value="">Selectionner</option>
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
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Code postal
            </label>
            <input
              className="input-field"
              value={form.postal_code}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              placeholder="301"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Rue / Quartier
          </label>
          <input
            className="input-field"
            value={form.street}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
            placeholder="Lot II M 45 Bis, Ambalavao"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Pays
          </label>
          <input className="input-field bg-slate-50" value="Madagascar" disabled />
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
