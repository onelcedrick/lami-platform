"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WizardProgress from "./wizard/WizardProgress";
import Step1Infos from "./wizard/Step1Infos";
import Step2Details from "./wizard/Step2Details";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/analytics";

interface Category {
  id: string;
  name: string;
}

interface WizardForm {
  name: string;
  sku: string;
  brand: string;
  category_id: string;
  status: string;
  images: string[];
  price: string;
  compare_at_price: string;
  stock: string;
  stock_alert: string;
  short_description: string;
  description: string;
  attributes: Record<string, string>;
  is_featured: boolean;
  usage_tags: string[];
  tags: string[];
}

const EMPTY_FORM: WizardForm = {
  name: "",
  sku: "",
  brand: "",
  category_id: "",
  status: "active",
  images: [],
  price: "",
  compare_at_price: "",
  stock: "0",
  stock_alert: "5",
  short_description: "",
  description: "",
  attributes: {},
  is_featured: false,
  usage_tags: [],
  tags: [],
};

export default function ProductWizard({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<WizardForm>({
    ...EMPTY_FORM,
    category_id: categories[0]?.id || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateStep1 = () => {
    if (!form.name.trim()) return "Le nom est obligatoire";
    if (!form.sku.trim()) return "Le SKU est obligatoire";
    if (!form.brand.trim()) return "La marque est obligatoire";
    if (!form.category_id) return "La catégorie est obligatoire";
    return "";
  };

  const validateStep2 = () => {
    if (!form.price || Number(form.price) <= 0)
      return "Le prix doit être supérieur à 0";
    return "";
  };

  const goNext = () => {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep(2);
  };

  const goPrev = () => {
    setError("");
    setStep(1);
  };

  const handleSubmit = async () => {
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        brand: form.brand.trim(),
        category_id: form.category_id,
        status: form.status,
        images: form.images,
        price: Number(form.price),
        compare_at_price: form.compare_at_price
          ? Number(form.compare_at_price)
          : undefined,
        stock: parseInt(form.stock || "0", 10),
        stock_alert: parseInt(form.stock_alert || "5", 10),
        short_description: form.short_description.trim(),
        description: form.description.trim() || form.name.trim(),
        attributes: form.attributes,
        is_featured: form.is_featured,
        usage_tags: form.usage_tags,
        tags: form.tags,
      };

      const res = await api.createProduct(payload);
      if (!res.success) {
        setError(res.error || "Erreur lors de la création");
        return;
      }

      void logActivity({
        action: "product_created",
        category: "admin",
        message: `Produit créé: ${payload.name}`,
        resource: "product",
      });

      router.push("/admin/products");
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/products"
            className="text-sm text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
          >
            Retour aux produits
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--fg-primary)]">
            Nouveau produit
          </h1>
          <p className="text-sm text-[var(--fg-secondary)]">
            Créez un produit en 2 étapes simples
          </p>
        </div>
      </div>

      {/* Progression */}
      <WizardProgress
        currentStep={step}
        totalSteps={2}
        stepLabels={["Informations", "Détails"]}
      />

      {/* Erreur */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Card formulaire */}
      <div className="card-admin p-6 sm:p-8">
        {step === 1 && (
          <Step1Infos
            form={form}
            categories={categories}
            onChange={setField}
            skuAuto={true}
          />
        )}

        {step === 2 && (
          <Step2Details form={form} onChange={setField} />
        )}

        {/* Footer navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-6">
          <div>
            {step === 2 && (
              <button type="button" onClick={goPrev} className="btn-secondary">
                Précédent
              </button>
            )}
          </div>
          <div>
            {step === 1 && (
              <button type="button" onClick={goNext} className="btn-primary">
                Suivant →
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Création..." : "Créer le produit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
