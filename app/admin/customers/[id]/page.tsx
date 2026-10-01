import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/src/lib/auth/guards";
import { AdminLoadFailure } from "@/src/components/admin/admin-load-failure";

type AccountStatus = {
  user_id: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  account_created_at: string | null;
};

function formatWhen(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function customerStatus(role: string | null | undefined, account: AccountStatus | null) {
  if (account?.banned_until && new Date(account.banned_until).getTime() > Date.now()) {
    return "Suspended";
  }
  if (role === "admin") return "Admin";
  if (account && !account.email_confirmed_at) return "Pending email confirmation";
  return "Active customer";
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: profile, error }, { data: orders }, statusResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, role, created_at").eq("id", id).maybeSingle(),
    supabase.from("orders").select("id, order_number, total, status, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.rpc("admin_customer_account_status", { p_user_id: id }),
  ]);
  if (error) return <AdminLoadFailure message="Unable to load customer." title="Customer" />;
  if (!profile) notFound();

  const account = (Array.isArray(statusResult.data) ? statusResult.data[0] : statusResult.data) as AccountStatus | null;
  const verificationAvailable = !statusResult.error && Boolean(account);
  const lastOrder = orders?.[0]?.created_at ?? null;

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <Link className="text-sm text-[#173f35] underline" href="/admin/customers">Back to customers</Link>
      <section className="rounded-2xl bg-white p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#b8964c]">Customer</p>
        <h1 className="mt-2 text-3xl font-semibold break-words text-[#173f35]">{profile.full_name || "Customer"}</h1>
        <dl className="mt-4 grid gap-3 text-sm text-[#6b6b6b] sm:grid-cols-2">
          <div>
            <dt className="font-medium text-[#173f35]">Email</dt>
            <dd className="break-all">{profile.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Account ID</dt>
            <dd className="break-all">{profile.id}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Phone</dt>
            <dd>{profile.phone ?? "No phone provided"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Status</dt>
            <dd>{customerStatus(profile.role, verificationAvailable ? account : null)}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Account created</dt>
            <dd>{formatWhen(profile.created_at)}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Email confirmation</dt>
            <dd>
              {!verificationAvailable
                ? "Not available through this admin session"
                : account?.email_confirmed_at
                  ? `Confirmed ${formatWhen(account.email_confirmed_at)}`
                  : "Not confirmed"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Last sign-in</dt>
            <dd>{verificationAvailable ? formatWhen(account?.last_sign_in_at) : "Not available"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Orders</dt>
            <dd>{orders?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#173f35]">Last order</dt>
            <dd>{formatWhen(lastOrder)}</dd>
          </div>
        </dl>
      </section>
      <section className="rounded-2xl bg-white p-6">
        <h2 className="font-semibold text-[#173f35]">Order history</h2>
        {!orders?.length ? (
          <p className="mt-3 text-sm text-[#6b6b6b]">No orders yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((order) => (
              <Link className="flex flex-wrap justify-between gap-2 border-b border-[#173f35]/10 py-3" href={`/admin/orders/${order.id}`} key={order.id}>
                <span>{order.order_number}</span>
                <span>${Number(order.total).toFixed(2)} · {order.status}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
