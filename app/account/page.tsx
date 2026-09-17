import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import LogoutButton from "@/src/components/auth/logout-button";
import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import Link from "next/link";
import { CustomerOrderCard } from "@/src/components/customer/customer-order-card";
import { AddAddressForm } from "@/src/components/customer/add-address-form";
import { firstNameFrom } from "@/src/lib/customer/display-name";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [{ data: profile }, { data: orders }, { data: addresses }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, total, fulfillment_method, created_at, order_items(product_name, quantity)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("addresses")
      .select("id, full_name, address_line_1, address_line_2, city, state, postal_code, country, is_default")
      .order("is_default", { ascending: false })
      .limit(8),
  ]);
  const name = firstNameFrom(profile?.full_name || user.user_metadata.full_name, user.email);
  const recent = orders?.slice(0, 3) ?? [];
  const history = orders?.slice(3) ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <SmartBackButton fallbackHref="/" fallbackLabel="Back to home" />
      <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-gold">Your Ivoire Shop</p>
      <h1 className="mt-2 text-4xl font-semibold text-forest-green">Welcome back, {name}</h1>
      <p className="mt-3 text-muted">{user.email}</p>

      <section className="mt-10" id="recent-orders">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-forest-green">Recent orders</h2>
            <p className="mt-1 text-sm text-muted">Your newest groceries, ready to reorder.</p>
          </div>
          <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="#order-history">
            Order history
          </Link>
        </div>
        {recent.length ? (
          <div className="mt-5 grid gap-4">
            {recent.map((order) => <CustomerOrderCard key={order.id} order={order} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-forest-green/20 bg-[#f7f3ee] p-6">
            <p className="font-semibold text-forest-green">Your first order is waiting.</p>
            <Link className="mt-3 inline-flex text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">
              Start shopping
            </Link>
          </div>
        )}
      </section>

      <section className="mt-12" id="order-history">
        <h2 className="text-2xl font-semibold text-forest-green">Order history</h2>
        {history.length ? (
          <div className="mt-5 grid gap-4">
            {history.map((order) => <CustomerOrderCard key={`history-${order.id}`} order={order} />)}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No orders yet. Your first pantry restock can start in the shop.</p>
        )}
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-2" id="addresses">
        <article className="rounded-2xl border border-black/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Saved addresses</p>
          <h2 className="mt-2 text-xl font-semibold text-forest-green">Delivery details</h2>
          {addresses?.length ? (
            <div className="mt-4 space-y-3">
              {addresses.map((address) => (
                <div className="rounded-xl bg-[#f7f3ee] p-4 text-sm text-muted" key={address.id}>
                  <p className="font-semibold text-forest-green">
                    {address.full_name}{address.is_default ? " · Default" : ""}
                  </p>
                  <p>{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}</p>
                  <p>{[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}</p>
                  <p>{address.country}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Add a delivery address for faster checkout.</p>
          )}
          <AddAddressForm />
        </article>
        <article className="rounded-2xl border border-black/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Your account</p>
          <h2 className="mt-2 text-xl font-semibold text-forest-green">Keep shopping your way</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-forest-green px-4 py-2.5 text-sm font-semibold text-white" href="/shop">
              Continue shopping
            </Link>
            <Link className="rounded-lg border border-forest-green/20 px-4 py-2.5 text-sm font-semibold text-forest-green" href="/wishlist">
              Favorites
            </Link>
          </div>
          <LogoutButton />
        </article>
      </section>
    </main>
  );
}
