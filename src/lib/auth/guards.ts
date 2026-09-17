import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

// This is intentionally not configurable via a public environment variable:
// a Vercel deployment must always run the real admin authorization checks.
const isLocalDevelopment =
  process.env.NODE_ENV === "development" && process.env.VERCEL !== "1";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  return { supabase, user };
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isLocalDevelopment) {
      return {
        supabase,
        user: null,
        profile: { full_name: "Admin (dev bypass)", role: "admin" },
      };
    }
    redirect("/login?next=/admin");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    redirect("/?error=unauthorized");
  }

  return { supabase, user, profile };
}
