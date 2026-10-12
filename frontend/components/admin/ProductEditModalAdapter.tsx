"use client";

import ProductEditModal from "./ProductEditModal";
import type { ProductForm } from "./ProductEditModal";

// Adaptateur entre l'ancien FormState (images: string, attributes: any)
// et le nouveau ProductEditModal (images: string[], attributes: Record<string,string>)

interface FormState {
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
  status: string;
  is_featured: boolean;
  attributes: Record<string, string | number | boolean>;
}

interface Props {
  open: boolean;
  editing: boolean;
  form: FormState;
  categories: { id: string; name: string }[];
  error: string;
  onChange: (field: string, value: unknown) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProductEditModalAdapter({
  open,
  editing,
  form,
  categories,
  error,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  // Adapter form -> ProductForm
  const adaptedForm: ProductForm = {
    name: form.name,
    sku: form.sku,
    brand: form.brand,
    category_id: form.category_id,
    price: form.price,
    compare_at_price: form.compare_at_price,
    stock: form.stock,
    stock_alert: form.stock_alert,
    short_description: form.short_description,
    description: form.description,
    images: form.images.split(/\n/).map((s) => s.trim()).filter(Boolean),
    attributes: Object.fromEntries(
      Object.entries(form.attributes).map(([k, v]) => [k, String(v)])
    ),
    status: form.status,
    is_featured: form.is_featured,
  };

  // Adapter onChange -> onChange parent
  const handleChange = (field: keyof ProductForm, value: unknown) => {
    if (field === "images") {
      onChange("images", (value as string[]).join("\n"));
    } else if (field === "attributes") {
      onChange("attributes", value);
    } else {
      onChange(field, value);
    }
  };

  return (
    <ProductEditModal
      open={open}
      editing={editing}
      form={adaptedForm}
      categories={categories}
      error={error}
      onChange={handleChange}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
