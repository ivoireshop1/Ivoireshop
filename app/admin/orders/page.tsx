import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminOrdersPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Orders</h1>
      <p className="mt-3 text-muted">
        Order management will be implemented in the checkout phase.
      </p>
    </>
  );
}
