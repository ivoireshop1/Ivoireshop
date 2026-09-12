import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import LogoutButton from "@/src/components/auth/logout-button";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <SmartBackButton fallbackHref="/" fallbackLabel="Back to home" />
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">
        Account
      </p>
      <h1 className="text-4xl font-semibold text-forest-green">Welcome back</h1>
      <p className="mt-4 text-muted">{user.email}</p>
      <LogoutButton />
    </main>
  );
}
