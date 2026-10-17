"use client";

export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: Array<{ id?: string; name: string; slug: string; parentId?: string | null }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalizedValue = value === "All Products" ? "All" : value;
  const roots = categories.filter((category) => !category.parentId);
  const visibleRoots = roots.length ? roots : categories;
  const selected = categories.find((category) => category.slug === normalizedValue || category.name === normalizedValue);
  const selectedRoot = selected?.parentId
    ? categories.find((category) => category.id === selected.parentId || category.slug === selected.parentId)
    : selected && !selected.parentId
      ? selected
      : null;
  const subcategories = selectedRoot?.id
    ? categories.filter((category) => category.parentId === selectedRoot.id)
    : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${normalizedValue === "All" ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`} onClick={() => onChange("All")} type="button">
          All
        </button>
        {visibleRoots.map((category) => (
          <button
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${normalizedValue === category.slug || normalizedValue === category.name || selectedRoot?.slug === category.slug ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`}
            key={category.slug}
            onClick={() => onChange(category.slug)}
            type="button"
          >
            {category.name}
          </button>
        ))}
      </div>
      {subcategories.length ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {subcategories.map((category) => (
            <button
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${normalizedValue === category.slug ? "bg-forest-green text-white" : "border border-black/10 bg-surface text-muted"}`}
              key={category.slug}
              onClick={() => onChange(category.slug)}
              type="button"
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
