"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatAriary } from "@/lib/currency";
import { logActivity } from "@/lib/analytics";
import StatusBadge from "@/components/ui/StatusBadge";
import ProductImportModal from "@/components/admin/ProductImportModal";
import ImageUploader from "@/components/admin/ImageUploader";
import AttributesEditor from "@/components/admin/AttributesEditor";

interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  sku: string;
  price: number;
  compare_at_price?: number | null;
  stock: number;
  stock_alert: number;
  status: string;
  is_featured: boolean;
  category_id: string;
  category_name?: string;
  description?: string;
  short_description?: string;
  images?: string[];
  tags?: string[];
  usage_tags?: string[];
  attributes?: Record<string, unknown>;
  sales_count?: number;
  view_count?: number;
}

type FormState = {
  name: string;
  description: string;
  short_description: string;
  sku: string;
  category_id: string;
  brand: string;
  price: string;
  compare_at_price: string;
  stock: string;
  stock_alert: string;
  images: string;
  tags: string;
  usage_tags: string;
  is_featured: boolean;
  attributes: Record<string, string | number | boolean>;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  short_description: "",
  sku: "",
  category_id: "",
  brand: "",
  price: "",
  compare_at_price: "",
  stock: "0",
  stock_alert: "5",
  images: "",
  tags: "",
  usage_tags: "",
  is_featured: false,
  attributes: {},
});

function productToForm(p: Product): FormState {
  return {
    name: p.name || "",
    description: p.description || "",
    short_description: p.short_description || "",
    sku: p.sku || "",
    category_id: p.category_id || "",
    brand: p.brand || "",
    price: String(p.price ?? ""),
    compare_at_price:
      p.compare_at_price != null ? String(p.compare_at_price) : "",
    stock: String(p.stock ?? 0),
    stock_alert: String(p.stock_alert ?? 5),
    images: (p.images || []).join("\n"),
    tags: (p.tags || []).join(", "),
    usage_tags: (p.usage_tags || []).join(", "),
    is_featured: !!p.is_featured,
    attributes:
      (p.attributes as Record<string, string | number | boolean>) || {},
  };
}

function formToPayload(f: FormState) {
  const price = Number(f.price);
  const compare = f.compare_at_price.trim()
    ? Number(f.compare_at_price)
    : undefined;
  const images = f.images
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = f.tags
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const usage_tags = f.usage_tags
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    name: f.name.trim(),
    description: f.description.trim() || f.name.trim(),
    short_description: f.short_description.trim(),
    sku: f.sku.trim(),
    category_id: f.category_id,
    brand: f.brand.trim(),
    price,
    compare_at_price: compare && compare > 0 ? compare : undefined,
    stock: Math.max(0, parseInt(f.stock || "0", 10) || 0),
    stock_alert: Math.max(0, parseInt(f.stock_alert || "0", 10) || 0),
    images,
    tags,
    usage_tags,
    is_featured: f.is_featured,
    attributes: f.attributes || {},
  };
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (search) params.search = search;
      if (categoryFilter) params.category_id = categoryFilter;

      const [prodRes, catRes] = await Promise.all([
        api.listProducts(params),
        api.listCategories(),
      ]);
      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data as Product[]);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data as Category[]);
      }
    } catch {
      setError("Impossible de charger le catalogue");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = products;
    if (stockFilter === "low") {
      list = list.filter((p) => p.stock > 0 && p.stock <= (p.stock_alert || 5));
    } else if (stockFilter === "out") {
      list = list.filter((p) => p.stock <= 0);
    }
    return list;
  }, [products, stockFilter]);

  const lowStockCount = products.filter(
    (p) => p.stock > 0 && p.stock <= (p.stock_alert || 5)
  ).length;
  const outCount = products.filter((p) => p.stock <= 0).length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      category_id: categories[0]?.id || "",
    });
    setModalOpen(true);
    setError("");
    setMessage("");
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm(productToForm(p));
    setModalOpen(true);
    setError("");
    setMessage("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = formToPayload(form);
    if (!payload.name || !payload.sku || !payload.category_id || !payload.brand) {
      setError("Nom, SKU, marque et categorie sont obligatoires");
      setSaving(false);
      return;
    }
    if (!(payload.price > 0)) {
      setError("Prix (Ar) doit etre superieur a 0");
      setSaving(false);
      return;
    }

    try {
      if (editing) {
        const res = await api.updateProduct(editing.id, payload);
        if (!res.success) {
          setError(res.error || "Echec de la mise a jour");
          return;
        }
        setMessage("Produit mis a jour");
        void logActivity({
          action: "product_updated",
          category: "admin",
          message: `Produit mis a jour: ${payload.name}`,
          resource: "product",
          resource_id: editing.id,
        });
      } else {
        const res = await api.createProduct(payload);
        if (!res.success) {
          setError(res.error || "Echec de la creation");
          return;
        }
        setMessage("Produit cree");
        void logActivity({
          action: "product_created",
          category: "admin",
          message: `Produit cree: ${payload.name}`,
          resource: "product",
        });
      }
      setModalOpen(false);
      await load();
    } catch {
      setError("Erreur reseau");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.deleteProduct(deleteTarget.id);
      if (res.success) {
        setMessage(`Produit supprime: ${deleteTarget.name}`);
        void logActivity({
          action: "product_deleted",
          category: "admin",
          message: `Produit supprime: ${deleteTarget.name}`,
          resource: "product",
          resource_id: deleteTarget.id,
        });
        setDeleteTarget(null);
        await load();
      } else {
        setError(res.error || "Suppression impossible");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const res = await api.createCategory({
        name: catName.trim(),
        description: catDesc.trim() || undefined,
      });
      if (res.success) {
        setMessage(`Categorie creee: ${catName}`);
        void logActivity({
          action: "category_created",
          category: "admin",
          message: `Categorie: ${catName}`,
          resource: "category",
        });
        setCatName("");
        setCatDesc("");
        setCatModal(false);
        await load();
      } else {
        setError(res.error || "Echec creation categorie");
      }
    } catch {
      setError("Erreur reseau");
    } finally {
      setCatSaving(false);
    }
  };

  const catNameById = (id: string) =>
    categories.find((c) => c.id === id)?.name || "—";

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Produits
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            CRUD catalogue · prix en Ariary · stock
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCatModal(true)} className="btn-secondary text-sm">
            Categories
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="btn-secondary text-sm"
          >
            Importer CSV
          </button>
          <button type="button" onClick={openCreate} className="btn-primary text-sm">
            + Nouveau produit
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-400">Total produits</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
            {products.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}
          className={`card p-4 text-left transition ${
            stockFilter === "low" ? "ring-2 ring-amber-400" : ""
          }`}
        >
          <p className="text-xs uppercase text-amber-600">Stock bas</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{lowStockCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === "out" ? "all" : "out")}
          className={`card p-4 text-left transition ${
            stockFilter === "out" ? "ring-2 ring-red-400" : ""
          }`}
        >
          <p className="text-xs uppercase text-red-600">Rupture</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{outCount}</p>
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher nom, marque, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-64"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">Toutes categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {stockFilter !== "all" && (
          <button
            type="button"
            onClick={() => setStockFilter("all")}
            className="text-sm text-primary-600 hover:underline"
          >
            Reinitialiser filtre stock
          </button>
        )}
      </div>

      {message && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </div>
      )}
      {error && !modalOpen && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Categorie</th>
              <th className="px-4 py-3">Prix (Ar)</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Chargement...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Aucun produit
                  <div className="mt-3">
                    <button type="button" onClick={openCreate} className="btn-primary text-sm">
                      Creer le premier produit
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const low = p.stock > 0 && p.stock <= (p.stock_alert || 5);
                const out = p.stock <= 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {p.name}
                        {p.is_featured && (
                          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Vedette
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.brand} · {p.sku}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {p.category_name || catNameById(p.category_id)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {formatAriary(p.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          out
                            ? "font-semibold text-red-600"
                            : low
                              ? "font-semibold text-amber-600"
                              : "text-slate-700 dark:text-slate-300"
                        }
                      >
                        {p.stock}
                      </span>
                      <span className="text-xs text-slate-400">
                        {" "}
                        / alerte {p.stock_alert || 5}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={p.status === "active" ? "delivered" : "cancelled"}
                        label={p.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="mr-2 text-sm font-medium text-primary-600 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
          <div className="card w-full max-w-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {editing ? "Modifier le produit" : "Nouveau produit"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                Fermer
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Nom *
                </label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  SKU *
                </label>
                <input
                  className="input-field"
                  value={form.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Marque *
                </label>
                <input
                  className="input-field"
                  value={form.brand}
                  onChange={(e) => setField("brand", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Categorie *
                </label>
                <select
                  className="input-field"
                  value={form.category_id}
                  onChange={(e) => setField("category_id", e.target.value)}
                  required
                >
                  <option value="">Selectionner...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Prix (Ariary) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="input-field"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  placeholder="ex: 1800000"
                  required
                />
                {form.price && Number(form.price) > 0 && (
                  <p className="mt-1 text-xs text-primary-600">
                    {formatAriary(Number(form.price))}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Prix compare (Ar)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input-field"
                  value={form.compare_at_price}
                  onChange={(e) => setField("compare_at_price", e.target.value)}
                  placeholder="Ancien prix barre"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.stock}
                    onChange={(e) => setField("stock", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Alerte stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.stock_alert}
                    onChange={(e) => setField("stock_alert", e.target.value)}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Description courte
                </label>
                <input
                  className="input-field"
                  value={form.short_description}
                  onChange={(e) => setField("short_description", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Description
                </label>
                <textarea
                  className="input-field min-h-[80px]"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>

              {/* 📸 Upload d'images */}
              <div className="sm:col-span-2">
                <ImageUploader
                  value={form.images
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)}
                  onChange={(urls) => setField("images", urls.join("\n"))}
                  max={8}
                  maxSizeMB={5}
                  label="Photos du produit"
                />
              </div>

              {/* ⚙️ Caractéristiques dynamiques */}
              <div className="sm:col-span-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <AttributesEditor
                  key={editing?.id ?? "new"}
                  value={form.attributes}
                  onChange={(attrs) => setField("attributes", attrs)}
                  label="Caractéristiques techniques"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Tags (virgules)
                </label>
                <input
                  className="input-field"
                  value={form.tags}
                  onChange={(e) => setField("tags", e.target.value)}
                  placeholder="ssd, nvme"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Usage tags
                </label>
                <input
                  className="input-field"
                  value={form.usage_tags}
                  onChange={(e) => setField("usage_tags", e.target.value)}
                  placeholder="gaming, bureautique"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="featured"
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setField("is_featured", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="featured" className="text-sm text-slate-700 dark:text-slate-300">
                  Produit vedette (accueil / popularite)
                </label>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? "Enregistrement..." : editing ? "Enregistrer" : "Creer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Categories
              </h2>
              <button
                type="button"
                onClick={() => setCatModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                Fermer
              </button>
            </div>

            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2 dark:border-slate-800">
              {categories.length === 0 ? (
                <li className="px-2 py-3 text-sm text-slate-400">
                  Aucune categorie
                </li>
              ) : (
                categories.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {c.name}
                    {c.description && (
                      <span className="ml-2 text-xs text-slate-400">
                        {c.description}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Nouvelle categorie *
                </label>
                <input
                  className="input-field"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="ex: Accessoires"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Description
                </label>
                <input
                  className="input-field"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCatModal(false)} className="btn-secondary">
                  Fermer
                </button>
                <button type="submit" disabled={catSaving} className="btn-primary disabled:opacity-50">
                  {catSaving ? "..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Supprimer le produit ?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.sku}) sera
              supprime definitivement.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
    </div>
  );
}
