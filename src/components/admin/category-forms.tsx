"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CategoryImageField } from "@/src/components/admin/category-image-field";
import type { CategorySaveState } from "@/src/lib/catalog/actions";
import { isCanonicalSlug } from "@/src/lib/catalog/canonical-categories";

export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  parent_id?: string | null;
  sort_order?: number | null;
};

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
      className="space-y-4 rounded-[28px] border border-[#173f35]/10 bg-white p-5 sm:p-6"
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
      <h2 className="font-semibold text-[#173f35]">Move or merge products</h2>
      <p className="text-sm text-[#6b6b6b]">
        Use this when you need to move every product between categories. Primary storefront categories cannot be merged away.
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
  defaultParentId = "",
  title = "Add category",
  compact = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  parents?: Array<{ id: string; name: string }>;
  defaultParentId?: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <form action={action} className={`grid gap-3 rounded-[28px] border border-[#173f35]/10 bg-white p-5 shadow-[0_12px_32px_rgba(23,63,53,0.04)] sm:p-6 ${compact ? "" : "lg:grid-cols-2"}`}>
      <div className={compact ? "" : "lg:col-span-2"}>
        <h2 className="font-semibold text-[#173f35]">{title}</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          {defaultParentId || compact
            ? "Creates a subcategory under the selected parent. It appears in the storefront when active."
            : "Create a top-level category or pick a parent to add a subcategory."}
        </p>
      </div>
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="name" placeholder="Name" required />
      {!compact ? <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" name="slug" placeholder="Slug (optional)" /> : null}
      <select className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue={defaultParentId} name="parent_id">
        <option value="">Top-level category</option>
        {parents.map((parent) => (
          <option key={parent.id} value={parent.id}>{parent.name}</option>
        ))}
      </select>
      <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3" defaultValue={0} name="sort_order" placeholder="Sort order" type="number" />
      {!compact ? (
        <>
          <input className="min-h-11 rounded-xl border border-[#173f35]/15 px-4 py-3 lg:col-span-2" name="description" placeholder="Description" />
          <div className="lg:col-span-2">
            <CategoryImageField />
          </div>
        </>
      ) : null}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "" : "lg:col-span-2"}`}>
        <label className="flex min-h-11 items-center gap-2 text-sm text-[#173f35]">
          <input defaultChecked name="is_active" type="checkbox" />
          Visible on storefront
        </label>
        <SubmitButton
          className="min-h-11 rounded-xl bg-[#173f35] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          label={defaultParentId || compact ? "Add subcategory" : "Add category"}
          pendingLabel="Saving..."
        />
      </div>
    </form>
  );
}

function CategoryEditForm({
  category,
  isCanonical,
  parents,
  totalCount,
  updateAction,
}: {
  category: AdminCategoryRow;
  isCanonical: boolean;
  parents: Array<{ id: string; name: string }>;
  totalCount: number;
  updateAction: (prev: CategorySaveState, formData: FormData) => Promise<CategorySaveState>;
}) {
  const [state, action] = useActionState(updateAction, null);

  return (
    <form action={action} className="mt-4 grid gap-3 border-t border-[#173f35]/10 pt-4">
      <input name="id" type="hidden" value={category.id} />
      <input name="slug" type="hidden" value={category.slug} />
      {state?.message ? (
        <p className={`text-sm ${state.ok ? "text-[#173f35]" : "text-[#7f1d1d]"}`}>{state.message}</p>
      ) : null}
      <label className="text-sm text-[#173f35]">
        Name
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
        Display order
        <input className="mt-2 min-h-11 w-full rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={category.sort_order ?? 0} name="sort_order" type="number" />
      </label>
      {!isCanonical ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-[#173f35]">
          <input defaultChecked={category.is_active} name="is_active" type="checkbox" />
          Visible on storefront
        </label>
      ) : (
        <input name="is_active" type="hidden" value="on" />
      )}
      {isCanonical ? <p className="text-xs text-[#6b6b6b]">Display name can change. The slug stays {category.slug} so shop URLs remain valid.</p> : null}
      {!isCanonical && totalCount > 0 ? <p className="text-xs text-[#6b6b6b]">Assigned products stay linked. Delete stays blocked while products are assigned.</p> : null}
      <SubmitButton className="min-h-11 w-fit rounded-xl bg-[#173f35] px-4 text-sm font-medium text-white disabled:opacity-60" label="Save changes" pendingLabel="Saving..." />
    </form>
  );
}

function CategoryActions({
  category,
  isCanonical,
  totalCount,
  childCount = 0,
  deleteAction,
  deactivateAction,
  activateAction,
}: {
  category: AdminCategoryRow;
  isCanonical: boolean;
  totalCount: number;
  childCount?: number;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
  activateAction: (formData: FormData) => void | Promise<void>;
}) {
  const canDelete = !isCanonical && totalCount === 0 && childCount === 0;
  return (
    <div className="flex flex-wrap gap-2">
      {!isCanonical && category.is_active ? (
        <form
          action={deactivateAction}
          onSubmit={(event) => {
            if (!window.confirm(`Hide “${category.name}” from the storefront?`)) event.preventDefault();
          }}
        >
          <input name="id" type="hidden" value={category.id} />
          <button className="min-h-11 px-3 text-sm font-semibold text-[#7c5d1a] underline underline-offset-4" type="submit">
            Hide
          </button>
        </form>
      ) : null}
      {!isCanonical && !category.is_active ? (
        <form action={activateAction}>
          <input name="id" type="hidden" value={category.id} />
          <button className="min-h-11 px-3 text-sm font-semibold text-[#173f35] underline underline-offset-4" type="submit">
            Show
          </button>
        </form>
      ) : null}
      {canDelete ? (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`Delete “${category.name}”? This cannot be undone.`)) event.preventDefault();
          }}
        >
          <input name="id" type="hidden" value={category.id} />
          <button className="min-h-11 px-3 text-sm font-semibold text-[#7f1d1d] underline underline-offset-4" type="submit">
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function CategoryTreeManager({
  categories,
  productTotals,
  productActives,
  createAction,
  updateAction,
  deleteAction,
  deactivateAction,
  activateAction,
}: {
  categories: AdminCategoryRow[];
  productTotals: Record<string, number>;
  productActives: Record<string, number>;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (prev: CategorySaveState, formData: FormData) => Promise<CategorySaveState>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deactivateAction: (formData: FormData) => void | Promise<void>;
  activateAction: (formData: FormData) => void | Promise<void>;
}) {
  const roots = useMemo(
    () => categories
      .filter((row) => !row.parent_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    [categories],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, AdminCategoryRow[]>();
    for (const row of categories) {
      if (!row.parent_id) continue;
      const list = map.get(row.parent_id) ?? [];
      list.push(row);
      map.set(row.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    }
    return map;
  }, [categories]);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(roots.filter((row) => row.is_active).map((row) => [row.id, true])),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<string | null>(null);

  const parentOptions = roots.map((row) => ({ id: row.id, name: row.name }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#173f35]">Category tree</h2>
          <p className="mt-1 text-sm text-[#6b6b6b]">Expand a category to manage its subcategories. Hidden categories stay below for cleanup.</p>
        </div>
      </div>

      {roots.map((root) => {
        const children = childrenByParent.get(root.id) ?? [];
        const open = Boolean(openIds[root.id]);
        const totalCount = productTotals[root.id] ?? 0;
        const activeCount = productActives[root.id] ?? 0;
        const canonical = isCanonicalSlug(root.slug);

        return (
          <article className={`rounded-[24px] border bg-white p-4 shadow-[0_10px_25px_rgba(23,63,53,0.04)] sm:p-5 ${root.is_active ? "border-[#173f35]/10" : "border-[#173f35]/08 opacity-85"}`} key={root.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button
                className="min-h-11 flex-1 text-left"
                onClick={() => setOpenIds((prev) => ({ ...prev, [root.id]: !open }))}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#173f35]/15 text-sm text-[#173f35]" aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-[#173f35]">{root.name}</h3>
                    <p className="mt-1 text-sm text-[#6b6b6b]">
                      {root.is_active ? "Visible" : "Hidden"} · {children.length} subcategor{children.length === 1 ? "y" : "ies"} · {totalCount} product{totalCount === 1 ? "" : "s"} ({activeCount} live)
                    </p>
                    <p className="mt-1 text-xs text-[#6b6b6b]">/{root.slug}</p>
                  </div>
                </div>
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]"
                  onClick={() => setEditingId((id) => (id === root.id ? null : root.id))}
                  type="button"
                >
                  {editingId === root.id ? "Close" : "Edit"}
                </button>
                <button
                  className="min-h-11 rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white"
                  onClick={() => {
                    setOpenIds((prev) => ({ ...prev, [root.id]: true }));
                    setAddingUnder((id) => (id === root.id ? null : root.id));
                  }}
                  type="button"
                >
                  {addingUnder === root.id ? "Cancel" : "Add subcategory"}
                </button>
                <CategoryActions
                  activateAction={activateAction}
                  category={root}
                  childCount={children.length}
                  deactivateAction={deactivateAction}
                  deleteAction={deleteAction}
                  isCanonical={canonical}
                  totalCount={totalCount + children.reduce((sum, child) => sum + (productTotals[child.id] ?? 0), 0)}
                />
              </div>
            </div>

            {editingId === root.id ? (
              <CategoryEditForm
                category={root}
                isCanonical={canonical}
                parents={parentOptions.filter((row) => row.id !== root.id)}
                totalCount={totalCount}
                updateAction={updateAction}
              />
            ) : null}

            {open ? (
              <div className="mt-4 space-y-3 border-t border-[#173f35]/10 pt-4">
                {addingUnder === root.id ? (
                  <CategoryCreateForm
                    action={createAction}
                    compact
                    defaultParentId={root.id}
                    parents={parentOptions}
                    title={`Add subcategory under ${root.name}`}
                  />
                ) : null}

                {children.length === 0 ? (
                  <p className="rounded-2xl bg-[#f4f7f5] px-4 py-3 text-sm text-[#6b6b6b]">
                    No subcategories yet. Add one to organize products under {root.name}.
                  </p>
                ) : null}

                {children.map((child) => {
                  const childTotal = productTotals[child.id] ?? 0;
                  const childActive = productActives[child.id] ?? 0;
                  return (
                    <div className={`rounded-2xl border px-4 py-4 ${child.is_active ? "border-[#173f35]/10 bg-[#fffdf9]" : "border-dashed border-[#173f35]/15 bg-[#f7f7f5]"}`} key={child.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-[#173f35]">{child.name}</h4>
                          <p className="mt-1 text-sm text-[#6b6b6b]">
                            {child.is_active ? "Visible" : "Hidden"} · {childTotal} product{childTotal === 1 ? "" : "s"} ({childActive} live)
                          </p>
                          <p className="mt-1 text-xs text-[#6b6b6b]">/{child.slug}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="min-h-11 rounded-xl border border-[#173f35]/20 px-4 text-sm font-semibold text-[#173f35]"
                            onClick={() => setEditingId((id) => (id === child.id ? null : child.id))}
                            type="button"
                          >
                            {editingId === child.id ? "Close" : "Edit"}
                          </button>
                          <CategoryActions
                            activateAction={activateAction}
                            category={child}
                            deactivateAction={deactivateAction}
                            deleteAction={deleteAction}
                            isCanonical={false}
                            totalCount={childTotal}
                          />
                        </div>
                      </div>
                      {editingId === child.id ? (
                        <CategoryEditForm
                          category={child}
                          isCanonical={false}
                          parents={parentOptions}
                          totalCount={childTotal}
                          updateAction={updateAction}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
