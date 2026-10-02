import { pageMetadata } from "@/src/lib/page-metadata";
import { requireAdmin } from "@/src/lib/auth/guards";
import Link from "next/link";

export const metadata = pageMetadata("Admin notifications", "Operational notification history.", "/admin/notifications", false);

export default async function AdminNotificationsPage() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase
    .from("admin_notifications")
    .select("id, event_type, title, message, order_id, target_path, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Operations</p>
      <h1 className="text-3xl font-semibold text-[#173f35]">Notifications</h1>
      <p className="text-sm text-[#6b6b6b]">History stays after refresh. Open a record from the bell or the links below.</p>
      <ul className="space-y-3">
        {(rows ?? []).length ? (rows ?? []).map((row) => (
          <li className="rounded-2xl border border-[#173f35]/10 bg-white p-4" key={row.id}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[#173f35]">{row.title}</p>
              {!row.read_at ? <span className="rounded-full bg-[#b8964c] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#173f35]">Unread</span> : null}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-[#6b6b6b]">{row.message}</p>
            <p className="mt-2 text-xs text-[#6b6b6b]">{new Date(row.created_at).toLocaleString()}</p>
            {row.target_path ? (
              <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#173f35] underline" href={row.target_path}>
                View
              </Link>
            ) : null}
          </li>
        )) : (
          <li className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-6 text-sm text-[#6b6b6b]">No operational notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
