import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminDiscountsPage() {
  const { supabase } = await requireAdmin();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, stock_quantity, is_active")
    .not("compare_at_price", "is", null)
    .order("compare_at_price", { ascending: false });

  if (error) {
    throw new Error("Unable to load discount pricing.");
  }

  const discountedProducts = (products ?? []).map((product) => {
    const price = Number(product.price ?? 0);
    const compareAtPrice = Number(product.compare_at_price ?? price);
    const discount = compareAtPrice > price ? compareAtPrice - price : 0;
    const percentOff = compareAtPrice > 0 ? Math.round((discount / compareAtPrice) * 100) : 0;

    return { ...product, discount, percentOff };
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Marketing</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Discounts</h1>
      </div>

      {!discountedProducts.length ? (
        <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-10 text-center text-[#6b6b6b]">
          No discounted products are currently configured. Use sale pricing in the product editor to create offers.
        </div>
      ) : (
        <div className="space-y-3">
          {discountedProducts.map((product) => (
            <div className="grid gap-3 rounded-2xl border border-[#173f35]/10 bg-white p-4 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] md:items-center" key={product.id}>
              <div>
                <p className="font-medium text-[#173f35]">{product.name}</p>
                <p className="text-xs text-[#6b6b6b]">{product.is_active ? "Live" : "Hidden"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Price</p>
                <p className="mt-1 text-[#173f35]">${Number(product.price).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Compare at</p>
                <p className="mt-1 text-[#173f35]">${Number(product.compare_at_price).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b6b6b]">Savings</p>
                <p className="mt-1 font-semibold text-[#173f35]">{product.percentOff}% off</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
