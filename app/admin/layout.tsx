import { AdminShell } from "@/src/components/admin/admin-shell";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
