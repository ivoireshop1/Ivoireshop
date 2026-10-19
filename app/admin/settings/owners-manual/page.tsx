import { OwnersManual } from "@/src/components/admin/owners-manual";
import { requireAdmin } from "@/src/lib/auth/guards";

export default async function OwnersManualPage() {
  await requireAdmin();
  return <OwnersManual />;
}