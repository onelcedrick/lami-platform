"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ProductWizard from "@/components/admin/ProductWizard";

interface Category {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.listCategories();
        if (res.success && res.data) {
          setCategories(res.data as Category[]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--fg-muted)]">
        Chargement...
      </div>
    );
  }

  return <ProductWizard categories={categories} />;
}
