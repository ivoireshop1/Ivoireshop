import { pageMetadata } from "@/src/lib/page-metadata";
import { requireAdmin } from "@/src/lib/auth/guards";
import { ChangePasswordForm } from "@/src/components/auth/change-password-form";
import { AdminNotificationSoundsToggle } from "@/src/components/admin/admin-notification-sounds-toggle";

export const metadata = pageMetadata("Admin account", "Admin account security.", "/admin/account", false);

export default async function AdminAccountPage() {
  const { supabase, user } = await requireAdmin();
  const { data: profile } = await supabase.from("profiles").select("admin_notification_sounds").eq("id", user.id).maybeSingle();
  return (
    <div className="max-w-xl space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Account</p>
      <h1 className="text-3xl font-semibold text-[#173f35]">Security</h1>
      <p className="text-sm text-[#6b6b6b]">Change the password for this signed-in administrator. This uses your existing Ivoire Shop login.</p>
      <ChangePasswordForm />
      <AdminNotificationSoundsToggle enabled={profile?.admin_notification_sounds !== false} />
    </div>
  );
}
