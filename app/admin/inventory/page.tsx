import { requireAdmin } from "@/src/lib/auth/guards";
import { updateInventory } from "@/src/lib/catalog/actions";

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ search?: string; low?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, stock_quantity, is_active, categories(name)")
    .order("stock_quantity", { ascending: true });

  if (error) throw new Error("Unable to load inventory.");
  const query = (params.search ?? "").toLowerCase();
  const items = (products ?? []).filter((product) =>
    (!params.low || (Number(product.stock_quantity) > 0 && Number(product.stock_quantity) <= 5)) &&
    (!query || product.name.toLowerCase().includes(query) || (product.sku ?? "").toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Inventory</h1>
      </div>
      {params.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Stock could not be updated. Use a whole number of zero or more.</p>}
      {params.success && <p className="rounded-xl bg-[#173f35]/5 p-3 text-sm text-[#173f35]">Stock updated.</p>}
      <form className="flex flex-wrap gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4" method="get">
        <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" defaultValue={params.search} name="search" placeholder="Search products or SKU" />
        <label className="flex items-center gap-2 text-sm text-[#173f35]"><input defaultChecked={params.low === "1"} name="low" type="checkbox" value="1" /> Low stock only</label>
        <button className="rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Filter</button>
      </form>
      {items.length === 0 ? <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center text-[#6b6b6b]">No inventory items match these filters.</div> : <div className="space-y-3">{items.map((product) => {
        const category = (product.categories as { name?: string } | null)?.name ?? "Uncategorized";
        const stock = Number(product.stock_quantity);
        const state = stock === 0 ? "Out of stock" : stock <= 5 ? "Low stock" : "In stock";
        return <form action={updateInventory} className="grid items-center gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-[1.4fr_0.8fr_0.7fr_0.8fr]" key={product.id}>
          <input name="id" type="hidden" value={product.id} />
          <div><p className="font-medium text-[#173f35]">{product.name}</p><p className="text-xs text-[#6b6b6b]">{category}{product.sku ? ` · ${product.sku}` : ""}</p></div>
          <p className={stock === 0 ? "text-sm text-red-700" : stock <= 5 ? "text-sm text-[#7c5d1a]" : "text-sm text-[#173f35]"}>{state}</p>
          <input className="rounded-xl border border-[#173f35]/15 px-3 py-2" min="0" name="stock_quantity" type="number" defaultValue={stock} />
          <button className="rounded-xl bg-[#173f35] px-4 py-2 text-sm text-white">Save stock</button>
        </form>;
      })}</div>}
    </div>
  );
}
