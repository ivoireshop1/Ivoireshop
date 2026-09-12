export function ProductBadge({ label }: { label: string }) {
  return <span className="absolute left-3 top-3 rounded-full bg-forest-green px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">{label}</span>;
}
