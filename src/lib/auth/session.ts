import { createClient } from "@/src/lib/supabase/server";
import type { NavRole } from "@/src/lib/auth/session-navigation";

export async function getNavRole(): Promise<NavRole> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "guest";

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin") return "admin";
  return "customer";
}
