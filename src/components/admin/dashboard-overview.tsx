import Link from "next/link";
import { AdminCard } from "@/src/components/admin/admin-card";
import { getAdminDashboardData } from "@/src/lib/admin/dashboard";

export async function DashboardOverview() {
  const dashboard = await getAdminDashboardData();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#173f35]/10 bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e8_100%)] p-6 shadow-[0_18px_50px_rgba(23,63,53,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#b8964c]">Good afternoon</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#173f35]">Here&apos;s what&apos;s happening with Ivoire Shop today.</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#173f35]/10 bg-white/80 px-3 py-1.5 text-sm text-[#173f35]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#173f35]" />
            {dashboard.storeStatus.label}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-[#173f35]/10 bg-white p-5 shadow-[0_10px_22px_rgba(23,63,53,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[#6b6b6b]">{metric.label}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                metric.tone === "positive"
                  ? "bg-[#173f35]/8 text-[#173f35]"
                  : metric.tone === "warning"
                    ? "bg-[#b8964c]/15 text-[#7c5d1a]"
                    : metric.tone === "danger"
                      ? "bg-[#7f1d1d]/10 text-[#7f1d1d]"
                      : "bg-[#f3efe9] text-[#173f35]"
              }`}>
                {metric.tone}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-[#173f35]">{metric.value}</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
        <AdminCard title="Needs attention" action={<Link href="/admin/inventory" className="text-sm text-[#173f35] underline-offset-2 hover:underline">Review all</Link>}>
          <div className="space-y-3">
            {dashboard.actionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4 transition hover:border-[#173f35]/20 hover:bg-white"
              >
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">{item.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#173f35]">{item.count}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#173f35]">{item.description}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${
                    item.tone === "positive"
                      ? "bg-[#173f35]/8 text-[#173f35]"
                      : item.tone === "warning"
                        ? "bg-[#b8964c]/15 text-[#7c5d1a]"
                        : item.tone === "danger"
                          ? "bg-[#7f1d1d]/10 text-[#7f1d1d]"
                          : "bg-[#f3efe9] text-[#173f35]"
                  }`}>
                    {item.tone}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Store status" action={<span className="rounded-full border border-[#173f35]/10 bg-[#173f35]/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#173f35]">Live</span>}>
          <div className="rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#6b6b6b]">Current status</p>
            <p className="mt-3 text-2xl font-semibold text-[#173f35]">{dashboard.storeStatus.label}</p>
            <p className="mt-2 text-sm text-[#6b6b6b]">{dashboard.storeStatus.description}</p>
          </div>

          <div className="mt-5 space-y-3">
            <Link href="/admin/store" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-white px-4 py-3 text-sm font-medium text-[#173f35] transition hover:border-[#173f35]/20">
              <span>Update store controls</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/content" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-white px-4 py-3 text-sm font-medium text-[#173f35] transition hover:border-[#173f35]/20">
              <span>Edit homepage</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <AdminCard title="Sales overview" action={<div className="flex items-center gap-2 text-xs text-[#6b6b6b]"><span>Today</span><span>7 Days</span><span>30 Days</span></div>}>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-[#6b6b6b]">Revenue</p>
                <p className="mt-2 text-2xl font-semibold text-[#173f35]">{formatCurrency(dashboard.todaysRevenue)}</p>
              </div>
              <div>
                <p className="text-sm text-[#6b6b6b]">Orders</p>
                <p className="mt-2 text-2xl font-semibold text-[#173f35]">{dashboard.todayOrderCount}</p>
              </div>
              <div>
                <p className="text-sm text-[#6b6b6b]">AOV</p>
                <p className="mt-2 text-2xl font-semibold text-[#173f35]">{formatCurrency(dashboard.averageOrderValue)}</p>
              </div>
            </div>

            <div className="grid h-40 grid-cols-7 items-end gap-2 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-4">
              {dashboard.revenueTrend.map((entry) => (
                <div key={entry.label} className="flex h-full flex-col justify-end items-center gap-2">
                  <div
                    className="w-full rounded-t-lg bg-[#173f35]"
                    style={{ height: `${Math.max(12, (entry.value / Math.max(...dashboard.revenueTrend.map((item) => item.value), 1)) * 100)}%` }}
                  />
                  <span className="text-[10px] text-[#6b6b6b]">{entry.label}</span>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Quick actions" action={<span className="text-xs text-[#6b6b6b]">Fast access</span>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Link href="/admin/products/new" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35] transition hover:bg-white">
              <span>Add Product</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/orders" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35] transition hover:bg-white">
              <span>View Orders</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/inventory" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35] transition hover:bg-white">
              <span>Manage Inventory</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/content" className="flex items-center justify-between rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] px-4 py-3 text-sm text-[#173f35] transition hover:bg-white">
              <span>Edit Homepage</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminCard title="Recent orders" action={<Link href="/admin/orders" className="text-sm text-[#173f35] underline-offset-2 hover:underline">View all orders →</Link>}>
          {dashboard.recentOrders.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[#173f35]/10">
              <div className="grid grid-cols-[1.2fr_1fr_0.65fr_0.75fr_0.8fr] gap-3 border-b border-[#173f35]/10 bg-[#f9f7f3] px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6b6b]">
                <span>Order</span>
                <span>Customer</span>
                <span>Items</span>
                <span>Total</span>
                <span>Status</span>
              </div>
              {dashboard.recentOrders.map((order) => (
                <Link href={`/admin/orders/${order.id}`} key={order.id} className="grid grid-cols-[1.2fr_1fr_0.65fr_0.75fr_0.8fr] gap-3 border-b border-[#173f35]/10 px-4 py-3 text-sm last:border-b-0 hover:bg-[#f9f7f3]">
                  <span className="font-medium text-[#173f35]">{order.orderNumber}</span>
                  <span className="text-[#6b6b6b]">{order.customerName}</span>
                  <span className="text-[#6b6b6b]">{order.itemCount}</span>
                  <span className="font-medium text-[#173f35]">{formatCurrency(order.total)}</span>
                  <span className="inline-flex w-fit rounded-full bg-[#173f35]/8 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#173f35]">{order.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-[#f9f7f3] p-8 text-center text-[#6b6b6b]">
              No orders yet. Your first orders will appear here.
            </div>
          )}
        </AdminCard>

        <AdminCard title="Best sellers" action={<Link href="/admin/analytics" className="text-sm text-[#173f35] underline-offset-2 hover:underline">View analytics</Link>}>
          {dashboard.bestSellers.length > 0 ? (
            <div className="space-y-3">
              {dashboard.bestSellers.map((product) => (
                <div key={product.productId} className="flex items-center gap-3 rounded-2xl border border-[#173f35]/10 bg-[#f9f7f3] p-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#173f35] text-sm font-semibold text-white">{product.productName.slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#173f35]">{product.productName}</p>
                    <p className="mt-1 text-xs text-[#6b6b6b]">{product.units} units sold · {formatCurrency(product.revenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6b6b6b]">Stock</p>
                    <p className="font-medium text-[#173f35]">{product.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#173f35]/20 bg-[#f9f7f3] p-8 text-center text-[#6b6b6b]">
              No sales data yet. Best sellers will appear once customers start ordering.
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}
