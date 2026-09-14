"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";
import {
  Discount,
  formatDiscountValue,
} from "@/lib/discount";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState<"global" | "category" | "product">("global");
  const [targetId, setTargetId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes, pRes] = await Promise.all([
        api.listDiscounts(),
        api.listCategories(),
        api.listProducts({ limit: 100 }),
      ]);
      if (dRes.success && dRes.data) setDiscounts(dRes.data as Discount[]);
      if (cRes.success && cRes.data) setCategories(cRes.data as Category[]);
      if (pRes.success && pRes.data) setProducts(pRes.data as Product[]);
    } catch {
      setError("Impossible de charger les promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setType("percentage");
    setValue("");
    setTarget("global");
    setTargetId("");
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const num = Number(value);
    if (!name.trim() || !(num > 0)) {
      setError("Nom et valeur valides requis");
      setSaving(false);
      return;
    }
    if (type === "percentage" && num > 100) {
      setError("Pourcentage maximum 100%");
      setSaving(false);
      return;
    }
    if (target !== "global" && !targetId) {
      setError("Selectionnez une cible (categorie ou produit)");
      setSaving(false);
      return;
    }

    let target_label = "Tous les produits";
    if (target === "category") {
      target_label =
        "Categorie: " +
        (categories.find((c) => c.id === targetId)?.name || targetId);
    } else if (target === "product") {
      const p = products.find((x) => x.id === targetId);
      target_label = "Produit: " + (p?.name || targetId.slice(0, 8));
    }

    try {
      const res = await api.createDiscount({
        name: name.trim(),
        type,
        value: num,
        target,
        target_id: target === "global" ? "" : targetId,
        target_label,
        is_active: true,
      });
      if (res.success) {
        setMessage("Promotion creee");
        void logActivity({
          action: "discount_created",
          category: "admin",
          message: `Promotion: ${name.trim()}`,
          resource: "discount",
        });
        resetForm();
        await load();
      } else {
        setError(res.error || "Echec creation");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    const res = await api.toggleDiscount(id);
    if (res.success) {
      await load();
    } else {
      setError(res.error || "Echec");
    }
  };

  const handleDelete = async (id: string, dname: string) => {
    if (!confirm(`Supprimer la promotion "${dname}" ?`)) return;
    const res = await api.deleteDiscount(id);
    if (res.success) {
      setMessage("Promotion supprimee");
      void logActivity({
        action: "discount_deleted",
        category: "admin",
        message: `Promotion supprimee: ${dname}`,
        resource: "discount",
        resource_id: id,
      });
      await load();
    } else {
      setError(res.error || "Echec suppression");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Promotions ({discounts.length})
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Remises en pourcentage ou montant fixe (Ar)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-sm"
        >
          {showForm ? "Fermer" : "+ Nouvelle promotion"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card mt-6 p-6">
          <h2 className="mb-4 font-bold text-slate-900 dark:text-slate-50">
            Nouvelle promotion
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="input-field"
              placeholder="Nom de la promotion"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              className="input-field"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "percentage" | "fixed_amount")
              }
            >
              <option value="percentage">Pourcentage (%)</option>
              <option value="fixed_amount">Montant fixe (Ar)</option>
            </select>
            <input
              type="number"
              min="1"
              step={type === "percentage" ? "1" : "100"}
              className="input-field"
              placeholder={
                type === "percentage"
                  ? "Valeur en % (ex: 15)"
                  : "Montant en Ar (ex: 100000)"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <select
              className="input-field"
              value={target}
              onChange={(e) => {
                setTarget(
                  e.target.value as "global" | "category" | "product"
                );
                setTargetId("");
              }}
            >
              <option value="global">Tous les produits</option>
              <option value="category">Par categorie</option>
              <option value="product">Produit specifique</option>
            </select>

            {target === "category" && (
              <select
                className="input-field sm:col-span-2"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
              >
                <option value="">Choisir une categorie...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {target === "product" && (
              <select
                className="input-field sm:col-span-2"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
              >
                <option value="">Choisir un produit...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? "..." : "Creer"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-center">Valeur</th>
              <th className="px-4 py-3 text-center">Cible</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            ) : discounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Aucune promotion — creez-en une pour afficher des prix
                  reduits
                </td>
              </tr>
            ) : (
              discounts.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {d.name}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">
                    {d.type === "percentage" ? "%" : "Ar"}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-slate-100">
                    {formatDiscountValue(d)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {d.target_label ||
                      (d.target === "global"
                        ? "Tous les produits"
                        : d.target)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggle(d.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        d.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {d.is_active ? "Oui" : "Non"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id, d.name)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
