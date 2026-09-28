"use client";

import { useFormStatus } from "react-dom";
import { CategoryImageField } from "@/src/components/admin/category-image-field";

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CategoryCreateForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return (
    <form action={action} className="grid gap-4 rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)] lg:grid-cols-2">
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="name" placeholder="Category name" required />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="slug" placeholder="Slug (optional)" />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3 lg:col-span-2" name="description" placeholder="Description" />
      <div className="lg:col-span-2">
        <CategoryImageField />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm text-[#173f35]">
          <input defaultChecked name="is_active" type="checkbox" />
          Active
        </label>
        <SubmitButton
          className="min-h-11 rounded-xl bg-[#173f35] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          label="Add category"
          pendingLabel="Adding..."
        />
      </div>
    </form>
  );
}

export function CategoryRowForm({
  category,
  totalCount,
  activeCount,
  isCanonical,
  updateAction,
  deleteAction,
  deactivateAction,
}: {
  category: { id: string; name: string; slug: string; description: string | null; image_url: string | null; is_active: boolean };
  totalCount: number;
  activeCount: number;
  isCanonical: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={updateAction} className="grid gap-3 rounded-[24px] border border-[#173f35]/10 bg-white p-5 shadow-[0_10px_25px_rgba(23,63,53,0.04)] lg:grid-cols-[1.1fr_1fr_1.3fr_auto]">
      <input name="id" type="hidden" value={category.id} />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-3 py-2 read-only:bg-[#f4f1ea]" defaultValue={category.name} name="name" readOnly={isCanonical} required />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-3 py-2 read-only:bg-[#f4f1ea]" defaultValue={category.slug} name="slug" readOnly={isCanonical} required />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.description ?? ""} name="description" placeholder="Description" />
      <label className="flex min-h-11 items-center gap-2 text-sm text-[#173f35]">
        {isCanonical ? <input name="is_active" type="hidden" value="on" /> : null}
        <input defaultChecked={category.is_active} disabled={isCanonical} name={isCanonical ? undefined : "is_active"} type="checkbox" />
        Active
      </label>
      <div className="lg:col-span-4">
        <CategoryImageField defaultValue={category.image_url} />
      </div>
      <div className="flex flex-col justify-center gap-1 text-sm text-[#6b6b6b]">
        <span>{totalCount} total</span>
        <span>{activeCount} active</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-4">
        {isCanonical ? <p className="text-xs text-[#6b6b6b]">Primary storefront category. Name and slug are locked.</p> : null}
        <SubmitButton className="min-h-11 text-sm font-medium text-[#173f35] underline-offset-2 hover:underline disabled:opacity-60" label="Save" pendingLabel="Saving..." />
        {!isCanonical && totalCount === 0 ? (
          <button className="min-h-11 text-sm font-medium text-[#7f1d1d] underline-offset-2 hover:underline" formAction={deleteAction} type="submit">
            Delete
          </button>
        ) : null}
        {!isCanonical && category.is_active ? (
          <button className="min-h-11 text-sm font-medium text-[#7c5d1a] underline-offset-2 hover:underline" formAction={deactivateAction} type="submit">
            Deactivate
          </button>
        ) : null}
        {!isCanonical && totalCount > 0 ? (
          <p className="text-xs text-[#6b6b6b]">Assigned products are kept. Deactivate instead of deleting.</p>
        ) : null}
      </div>
    </form>
  );
}
