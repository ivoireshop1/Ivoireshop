import Link from "next/link";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";

export default async function HandoverCleanupPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { count: demoOrders },
    { count: paidOrders },
    { count: customers },
    { count: admins },
    { count: activeProducts },
    { count: featuredProducts },
    { data: demoRows },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("is_demo", false),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_featured", true),
    supabase
      .from("orders")
      .select("id, confirmation_code, customer_name, total, created_at, is_demo")
      .eq("is_demo", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const steps = [
    {
      n: "01",
      title: "Backup first",
      body: "Export Supabase database (Dashboard → Database → Backups) or run an approved dump. Do not skip this step.",
    },
    {
      n: "02",
      title: "Review demo orders",
      body: `${demoOrders ?? 0} demo order(s) listed below. Keep until founder approves removal.`,
    },
    {
      n: "03",
      title: "Review test customers",
      body: `${customers ?? 0} customer profile(s). Identify probe/test emails manually before any cleanup.`,
    },
    {
      n: "04",
      title: "Confirm live catalog",
      body: `${featuredProducts ?? 0} featured / ${activeProducts ?? 0} active. Hide non-featured only after founder approval.`,
    },
    {
      n: "05",
      title: "No silent deletes",
      body: "This page never deletes data. Cleanup requires an explicit founder message naming what to remove.",
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#b8964c]">Phone checklist</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173f35]">Handover cleanup</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
          Prepared for founder review. Backup first. Nothing is deleted from this screen.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          ["Demo orders", demoOrders ?? 0],
          ["Paid/non-demo", paidOrders ?? 0],
          ["Customers", customers ?? 0],
          ["Admins", admins ?? 0],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-[#173f35]/10 bg-white p-4" key={String(label)}>
            <p className="text-xs text-[#6b6b6b]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#173f35]">{value}</p>
          </div>
        ))}
      </div>

      <ol className="space-y-3">
        {steps.map((step) => (
          <li className="rounded-[24px] border border-[#173f35]/10 bg-white p-4" key={step.n}>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#b8964c]">{step.n}</p>
            <h2 className="mt-1 text-lg font-semibold text-[#173f35]">{step.title}</h2>
            <p className="mt-1 text-sm leading-6 text-[#6b6b6b]">{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-[24px] border border-[#173f35]/10 bg-white p-4">
        <h2 className="text-lg font-semibold text-[#173f35]">Demo orders (preview)</h2>
        <ul className="mt-3 space-y-2">
          {(demoRows ?? []).map((order) => (
            <li className="rounded-xl bg-[#f9f7f3] px-3 py-2 text-sm text-[#173f35]" key={order.id}>
              <Link className="font-semibold underline underline-offset-2" href={`/admin/orders/${order.id}`}>
                {order.confirmation_code || order.id.slice(0, 8)}
              </Link>
              <span className="text-[#6b6b6b]">
                {" "}
                · {order.customer_name || "—"} · ${Number(order.total ?? 0).toFixed(2)}
              </span>
            </li>
          ))}
          {!demoRows?.length ? <li className="text-sm text-[#6b6b6b]">No demo orders found.</li> : null}
        </ul>
      </section>
    </div>
  );
}
