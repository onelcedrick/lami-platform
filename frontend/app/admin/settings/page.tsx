"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ShopSettings {
  shop_name: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  currency: string;
  mvola_number?: string;
  orange_number?: string;
  airtel_number?: string;
  shipping_fee: number;
  free_shipping_min: number;
  invoice_prefix: string;
}

const empty: ShopSettings = {
  shop_name: "L'AMI",
  currency: "MGA",
  shipping_fee: 10000,
  free_shipping_min: 500000,
  invoice_prefix: "FAC",
  city: "Toamasina",
  country: "Madagascar",
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<ShopSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getShopSettings();
        if (res.success && res.data) {
          setForm({ ...empty, ...(res.data as ShopSettings) });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof ShopSettings, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await api.updateShopSettings(form);
      if (res.success) {
        setMessage("Parametres enregistres");
        if (res.data) setForm({ ...empty, ...(res.data as ShopSettings) });
      } else {
        setMessage(res.error || "Erreur");
      }
    } catch {
      setMessage("Erreur reseau");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-slate-400">Chargement...</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
        Parametres boutique
      </h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        Informations L&apos;AMI (Toamasina) — facturation et Mobile Money
      </p>

      {message && (
        <div className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
          {message}
        </div>
      )}

      <div className="card mt-6 space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Nom boutique</span>
            <input
              className="input-field"
              value={form.shop_name}
              onChange={(e) => set("shop_name", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Devise</span>
            <input
              className="input-field"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Slogan</span>
            <input
              className="input-field"
              value={form.tagline || ""}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Telephone</span>
            <input
              className="input-field"
              value={form.phone || ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Email</span>
            <input
              className="input-field"
              value={form.email || ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Adresse</span>
            <input
              className="input-field"
              value={form.address || ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Ville</span>
            <input
              className="input-field"
              value={form.city || ""}
              onChange={(e) => set("city", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Region</span>
            <input
              className="input-field"
              value={form.region || ""}
              onChange={(e) => set("region", e.target.value)}
            />
          </label>
        </div>

        <h2 className="pt-2 font-semibold">Mobile Money</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">MVola</span>
            <input
              className="input-field"
              value={form.mvola_number || ""}
              onChange={(e) => set("mvola_number", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Orange Money</span>
            <input
              className="input-field"
              value={form.orange_number || ""}
              onChange={(e) => set("orange_number", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Airtel Money</span>
            <input
              className="input-field"
              value={form.airtel_number || ""}
              onChange={(e) => set("airtel_number", e.target.value)}
            />
          </label>
        </div>

        <h2 className="pt-2 font-semibold">Livraison & factures</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Frais livraison (Ar)</span>
            <input
              type="number"
              className="input-field"
              value={form.shipping_fee}
              onChange={(e) => set("shipping_fee", Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">
              Franco a partir de (Ar)
            </span>
            <input
              type="number"
              className="input-field"
              value={form.free_shipping_min}
              onChange={(e) => set("free_shipping_min", Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Prefixe facture</span>
            <input
              className="input-field"
              value={form.invoice_prefix}
              onChange={(e) => set("invoice_prefix", e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Metriques Prometheus : GET /metrics sur l&apos;API Gateway
      </p>
    </div>
  );
}
