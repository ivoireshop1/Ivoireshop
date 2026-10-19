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

export function CategoryReassignForm({
  action,
  categories,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Array<{ id: string; name: string; parent_id?: string | null }>;
}) {
  return (
    <form
      action={action}
      className="space-y-4 rounded-[28px] border border-[#173f35]/10 bg-white p-6"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const merge = data.get("merge") === "on";
        const fromName = categories.find((row) => row.id === String(data.get("from_id")))?.name ?? "this category";
        const toName = categories.find((row) => row.id === String(data.get("to_id")))?.name ?? "the destination";
        if (!window.confirm(merge
          ? `Move all products from ${fromName} to ${toName} and deactivate ${fromName}?`
          : `Reassign all products from ${fromName} to ${toName}?`)) {
          event.preventDefault();
        }
      }}
    >
      <h2 className="font-semibold text-[#173f35]">Move, merge, or bulk reassign</h2>
      <p className="text-sm text-[#6b6b6b]">
        Rename stays on each category row. Use this to move every assigned product, including subcategory assignments. Primary storefront categories cannot be merged away.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          From
          <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="from_id" required>
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}{category.parent_id ? " (subcategory)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          To
          <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3" name="to_id" required>
            <option value="">Choose destination</option>
            {categories.map((category) => (
              <option key={`to-${category.id}`} value={category.id}>{category.name}{category.parent_id ? " (subcategory)" : ""}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="merge" type="checkbox" />
        Merge after reassignment (deactivate the source category)
      </label>
      <SubmitButton
        className="min-h-11 rounded-xl bg-[#173f35] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        label="Reassign products"
        pendingLabel="Reassigning..."
      />
    </form>
  );
}

export function CategoryCreateForm({
  action,
  parents = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  parents?: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={action} className="grid gap-4 rounded-[28px] border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.04)] lg:grid-cols-2">
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="name" placeholder="Category or subcategory name" required />
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="slug" placeholder="Slug (optional)" />
      <select className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue="" name="parent_id">
        <option value="">Top-level category</option>
        {parents.map((parent) => (
          <option key={parent.id} value={parent.id}>{parent.name}</option>
        ))}
      </select>
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="sort_order" placeholder="Sort order (0)" type="number" />
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
  parents = [],
  updateAction,
  deleteAction,
  deactivateAction,
  activateAction,
}: {
  category: { id: string; name: string; slug: string; description: string | null; image_url: string | null; is_active: boolean; parent_id?: string | null; sort_order?: number | null };
  totalCount: number;
  activeCount: number;
  isCanonical: boolean;
  parents?: Array<{ id: string; name: string }>;
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
          <p className="mt-1 text-xs text-[#6b6b6b]">URL slug: {category.slug}{category.parent_id ? " · Subcategory" : ""}</p>
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
          {!isCanonical ? (
            <label className="text-sm text-[#173f35]">
              Parent category
              <select className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.parent_id ?? ""} name="parent_id">
                <option value="">Top-level</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.name}</option>
                ))}
              </select>
            </label>
          ) : <input name="parent_id" type="hidden" value="" />}
          <label className="text-sm text-[#173f35]">
            Sort order
            <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.sort_order ?? 0} name="sort_order" type="number" />
          </label>
          {isCanonical ? <p className="text-xs text-[#6b6b6b]">Display name can change. The slug stays {category.slug} so product assignments and shop URLs remain valid.</p> : null}
          {!isCanonical && totalCount > 0 ? <p className="text-xs text-[#6b6b6b]">Assigned products stay on this category ID. Delete is blocked while products are assigned.</p> : null}
          <SubmitButton className="min-h-11 w-fit rounded-xl bg-[#173f35] px-4 text-sm font-medium text-white disabled:opacity-60" label="Save" pendingLabel="Saving..." />
        </form>
      ) : null}
    </article>
  );
}
