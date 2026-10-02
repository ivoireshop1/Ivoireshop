import { getAdminDashboardData } from "@/src/lib/admin/dashboard";
import { DashboardOverview } from "@/src/components/admin/dashboard-overview";

export default async function AdminDashboardPage() {
  const initial = await getAdminDashboardData();
  return <DashboardOverview initial={initial} />;
}
