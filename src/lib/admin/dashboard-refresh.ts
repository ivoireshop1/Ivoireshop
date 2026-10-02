"use server";

import { getAdminDashboardData } from "@/src/lib/admin/dashboard";

export async function refreshAdminDashboard() {
  return getAdminDashboardData();
}
