import { getNavRole } from "@/src/lib/auth/session";
import { Header } from "@/src/components/layout/header";

export async function SiteHeader() {
  const initialRole = await getNavRole();
  return <Header initialRole={initialRole} />;
}
