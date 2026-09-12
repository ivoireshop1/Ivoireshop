import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const [productsResult, categoriesResult, ordersResult] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
    ]);

  const firstError = [
    productsResult.error,
    categoriesResult.error,
    ordersResult.error,
  ].find(Boolean);

  if (firstError) {
    throw new Error("Unable to load the admin dashboard.");
  }

  const products = productsResult.count;
  const categories = categoriesResult.count;
  const orders = ordersResult.count;

  return (
    <>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
        Administration
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-forest-green">
        Dashboard
      </h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Products", products],
          ["Categories", categories],
          ["Orders", orders],
        ].map(([label, value]) => (
          <section className="rounded-2xl bg-surface p-5 shadow-sm" key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-forest-green">
              {value ?? 0}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
