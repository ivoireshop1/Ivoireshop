import { requireAdmin } from "@/src/lib/auth/guards";

export default async function AdminInventoryPage() {
  await requireAdmin();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#173f35]">Inventory</h1>
      </div>
      <div className="rounded-2xl border border-[#173f35]/10 bg-white p-6 shadow-[0_12px_32px_rgba(23,63,53,0.05)]">
        <p className="text-sm text-[#6b6b6b]">Inventory controls are planned for the next phase.</p>
      </div>
    </div>
  );
}
