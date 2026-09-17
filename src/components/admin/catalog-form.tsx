import type { ReactNode } from "react";

type CategoryOption = { id: string; name: string };
type ProductValues = {
  id?: string;
  name?: string;
  slug?: string;
  category_id?: string;
  description?: string;
  short_description?: string | null;
  price?: number | string | null;
  compare_at_price?: number | string | null;
  sku?: string | null;
  stock_quantity?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  product_images?: Array<{ image_url?: string | null }>;
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
  const mainImage = product?.product_images?.[0]?.image_url ?? "";

  return (
    <form action={action} className="mt-6 max-w-4xl space-y-6 rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.08)]">
      {product?.id && <input name="id" type="hidden" value={product.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Basic Information</p>
            <Field label="Product Name" name="name" required value={product?.name} />
            <Field label="Slug" name="slug" value={product?.slug} />
            <label className="block text-sm font-medium text-[#173f35]">
              Category
              <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35" name="category_id" required defaultValue={product?.category_id}>
                <option value="">Select a category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <Field label="SKU" name="sku" value={product?.sku ?? undefined} />
            <label className="block text-sm font-medium text-[#173f35]">
              Description
              <textarea className="mt-2 min-h-36 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35" name="description" defaultValue={product?.description} />
            </label>
            <Field label="Short description" name="short_description" value={product?.short_description ?? undefined} />
          </section>

          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Pricing</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Regular Price" name="price" type="number" step="0.01" value={product?.price} />
              <Field label="Sale Price" name="compare_at_price" type="number" step="0.01" value={product?.compare_at_price ?? undefined} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Inventory</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Stock Quantity" name="stock_quantity" type="number" min="0" step="1" value={product?.stock_quantity} />
              <Field label="Low Stock Threshold" name="low_stock_threshold" type="number" min="0" step="1" value={product?.stock_quantity && product.stock_quantity <= 5 ? "5" : "5"} />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Images</p>
            <Field label="Main Image URL" name="image_url" value={mainImage} />
            <label className="block text-sm font-medium text-[#173f35]">
              Additional Image URLs
              <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35" name="gallery_images" placeholder="One URL per line" defaultValue={product?.product_images?.slice(1).map((image) => image.image_url).filter(Boolean).join("\n") ?? ""} />
            </label>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Availability</p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-[#173f35]">
                Status
                <select className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35" defaultValue={product?.is_active === false ? "hidden" : Number(product?.stock_quantity ?? 0) === 0 ? "sold_out" : "active"} name="status">
                  <option value="active">Active</option>
                  <option value="sold_out">Sold Out</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <Checkbox label="Featured Product" name="is_featured" checked={product?.is_featured ?? false} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Summary</p>
            <ul className="mt-3 space-y-2 text-sm text-[#6b6b6b]">
              <li>• Uses the existing products and product_images tables.</li>
              <li>• Keeps inventory and visibility consistent with current schema.</li>
              <li>• Preserves guest storefront behavior and admin security.</li>
            </ul>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
            <button className="rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-sm font-medium text-[#173f35]" name="save_as_draft" type="submit" value="true">
              Save Draft
            </button>
            <button className="rounded-xl bg-[#173f35] px-4 py-3 text-sm font-medium text-white" type="submit">
              {product?.id ? "Save Product" : "Create Product"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, name, value, ...props }: { label: string; name: string; value?: string | number | null; required?: boolean; type?: string; step?: string; min?: string }) {
  return (
    <label className="block text-sm font-medium text-[#173f35]">
      {label}
      <input className="mt-2 w-full rounded-xl border border-[#173f35]/15 bg-white px-4 py-3 text-[#173f35] outline-none transition focus:border-[#173f35]/35" name={name} defaultValue={value ?? undefined} {...props} />
    </label>
  );
}

function Checkbox({ label, name, checked }: { label: string; name: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-[#173f35]">
      <input defaultChecked={checked} name={name} type="checkbox" />
      {label}
    </label>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl border border-[#173f35]/15 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35]">{children}</p>;
}
