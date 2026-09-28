import { pageMetadata } from "@/src/lib/page-metadata";
import { AdminShell } from "@/src/components/admin/admin-shell";
import { requireAdmin } from "@/src/lib/auth/guards";

export const metadata = pageMetadata("Administration", "Ivoire Shop administration.", "/admin", false);
export const maxDuration = 60;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
