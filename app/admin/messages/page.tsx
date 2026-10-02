import { pageMetadata } from "@/src/lib/page-metadata";
import { requireAdmin } from "@/src/lib/auth/guards";
import { formatStoreDateTime } from "@/src/lib/store/timezone";

export const metadata = pageMetadata("Customer messages", "Website inquiries from the contact form.", "/admin/messages", false);

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin();
  const { data: rows } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Inbox</p>
      <h1 className="text-3xl font-semibold text-[#173f35]">Customer messages</h1>
      <ul className="space-y-3">
        {(rows ?? []).length ? (rows ?? []).map((row) => (
          <li className="rounded-2xl border border-[#173f35]/10 bg-white p-4" key={row.id}>
            <p className="font-semibold text-[#173f35]">{row.name}</p>
            <p className="break-all text-sm text-[#6b6b6b]">{row.email}</p>
            <p className="mt-2 whitespace-pre-line text-sm text-[#173f35]">{row.message}</p>
            <p className="mt-2 text-xs text-[#6b6b6b]">{formatStoreDateTime(row.created_at)}</p>
          </li>
        )) : (
          <li className="rounded-2xl border border-dashed border-[#173f35]/20 bg-white p-6 text-sm text-[#6b6b6b]">No website messages yet.</li>
        )}
      </ul>
    </div>
  );
}
