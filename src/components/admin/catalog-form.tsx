import type { ReactNode } from "react";

type CategoryOption = { id: string; name: string };
type ProductValues = {
  id?: string;
  name?: string;
  slug?: string;
  category_id?: string;
  description?: string;
  short_description?: string | null;
  price?: number | string;
  compare_at_price?: number | string | null;
  sku?: string | null;
  stock_quantity?: number;
  is_active?: boolean;
  is_featured?: boolean;
};

export function ProductForm({
  action,
  categories,
  product,
}: {
  action: (formData: FormData) => void;
  categories: CategoryOption[];
  product?: ProductValues;
}) {
  return (
    <form action={action} className="mt-6 max-w-2xl space-y-5 rounded-2xl bg-surface p-6 shadow-sm">
      {product?.id && <input name="id" type="hidden" value={product.id} />}
      <Field label="Name" name="name" required value={product?.name} />
      <Field label="Slug" name="slug" value={product?.slug} />
      <label className="block text-sm font-medium">
        Category
        <select className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3" name="category_id" required defaultValue={product?.category_id}>
          <option value="">Select a category</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <Field label="Short description" name="short_description" value={product?.short_description ?? undefined} />
      <label className="block text-sm font-medium">
        Description
        <textarea className="mt-2 min-h-32 w-full rounded-lg border border-black/15 px-4 py-3" name="description" required defaultValue={product?.description} />
      </label>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Price" name="price" required type="number" step="0.01" value={product?.price} />
        <Field label="Compare-at price" name="compare_at_price" type="number" step="0.01" value={product?.compare_at_price ?? undefined} />
        <Field label="Stock quantity" name="stock_quantity" required type="number" min="0" step="1" value={product?.stock_quantity} />
      </div>
      <Field label="SKU" name="sku" value={product?.sku ?? undefined} />
      <div className="flex flex-wrap gap-6 text-sm">
        <Checkbox label="Active" name="is_active" checked={product?.is_active ?? true} />
        <Checkbox label="Featured" name="is_featured" checked={product?.is_featured ?? false} />
      </div>
      <button className="rounded-lg bg-forest-green px-5 py-3 font-medium text-white" type="submit">
        {product?.id ? "Save product" : "Create product"}
      </button>
    </form>
  );
}

function Field({ label, name, value, ...props }: { label: string; name: string; value?: string | number | null; required?: boolean; type?: string; step?: string; min?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="mt-2 w-full rounded-lg border border-black/15 px-4 py-3" name={name} defaultValue={value ?? undefined} {...props} />
    </label>
  );
}

function Checkbox({ label, name, checked }: { label: string; name: string; checked: boolean }) {
  return <label className="flex items-center gap-2"><input defaultChecked={checked} name={name} type="checkbox" />{label}</label>;
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg bg-gold/15 px-4 py-3 text-sm text-forest-green">{children}</p>;
}
