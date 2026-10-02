"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CategoryImageField } from "@/src/components/admin/category-image-field";
import type { CategorySaveState } from "@/src/lib/catalog/actions";

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
  activateAction,
}: {
  category: { id: string; name: string; slug: string; description: string | null; image_url: string | null; is_active: boolean };
  totalCount: number;
  activeCount: number;
  isCanonical: boolean;
  updateAction: (prev: CategorySaveState, formData: FormData) => Promise<CategorySaveState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
  activateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateAction, null);

  return (
    <article className="rounded-[24px] border border-[#173f35]/10 bg-white p-5 shadow-[0_10px_25px_rgba(23,63,53,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#173f35]">{category.name}</h3>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            {category.is_active ? "Active" : "Inactive"} · {totalCount} product{totalCount === 1 ? "" : "s"} ({activeCount} live)
          </p>
          <p className="mt-1 text-xs text-[#6b6b6b]">URL slug: {category.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]" onClick={() => setEditing((open) => !open)} type="button">
            {editing ? "Close" : "Edit"}
          </button>
          {!isCanonical && category.is_active ? (
            <form action={deactivateAction}>
              <input name="id" type="hidden" value={category.id} />
              <button className="min-h-11 px-3 text-sm font-semibold text-[#7c5d1a] underline underline-offset-4" type="submit">
                Deactivate
              </button>
            </form>
          ) : null}
          {!isCanonical && !category.is_active ? (
            <form action={activateAction}>
              <input name="id" type="hidden" value={category.id} />
              <button className="min-h-11 px-3 text-sm font-semibold text-[#173f35] underline underline-offset-4" type="submit">
                Activate
              </button>
            </form>
          ) : null}
          {!isCanonical && totalCount === 0 ? (
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm(`Delete ${category.name}? This cannot be undone.`)) event.preventDefault();
              }}
            >
              <input name="id" type="hidden" value={category.id} />
              <button className="min-h-11 px-3 text-sm font-semibold text-[#7f1d1d] underline underline-offset-4" type="submit">
                Delete
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {state?.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-[#173f35]" : "text-[#7f1d1d]"}`}>{state.message}</p>
      ) : null}
      {editing ? (
        <form action={action} className="mt-4 grid gap-3 border-t border-[#173f35]/10 pt-4">
          <input name="id" type="hidden" value={category.id} />
          <input name="slug" type="hidden" value={category.slug} />
          {category.is_active ? <input name="is_active" type="hidden" value="on" /> : null}
          <label className="text-sm text-[#173f35]">
            Category Name
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.name} name="name" required />
          </label>
          <label className="text-sm text-[#173f35]">
            Description
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.description ?? ""} name="description" />
          </label>
          <CategoryImageField defaultValue={category.image_url} />
          {isCanonical ? <p className="text-xs text-[#6b6b6b]">Display name can change. The slug stays {category.slug} so product assignments and shop URLs remain valid.</p> : null}
          {!isCanonical && totalCount > 0 ? <p className="text-xs text-[#6b6b6b]">Assigned products stay on this category ID. Delete is blocked while products are assigned.</p> : null}
          <SubmitButton className="min-h-11 w-fit rounded-xl bg-[#173f35] px-4 text-sm font-medium text-white disabled:opacity-60" label="Save" pendingLabel="Saving..." />
        </form>
      ) : null}
    </article>
  );
}
