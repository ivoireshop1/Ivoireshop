import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminCustomersPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="text-3xl font-semibold text-forest-green">Customers</h1>
      <p className="mt-3 text-muted">
        Customer management will be implemented with the admin data workflows.
      </p>
    </>
  );
}
