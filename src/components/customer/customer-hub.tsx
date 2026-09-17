import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import { CustomerOrderCard } from "@/src/components/customer/customer-order-card";
import { FulfillmentMethodCards } from "@/src/components/checkout/fulfillment-method-cards";
import { firstNameFrom } from "@/src/lib/customer/display-name";

type WishlistPreview = {
  id: string;
  products: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

type AddressPreview = {
  id: string;
  full_name: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  is_default: boolean;
};

function nestedName(value: WishlistPreview["products"]) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function CustomerHub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: orders }, { data: addresses }, { data: favorites }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, total, fulfillment_method, created_at, order_items(product_name, quantity)")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("addresses")
      .select("id, full_name, address_line_1, address_line_2, city, state, postal_code, country, is_default")
      .order("is_default", { ascending: false })
      .limit(2),
    supabase
      .from("wishlist_items")
      .select("id, products(name, slug)")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const name = firstNameFrom(profile?.full_name || user.user_metadata.full_name, user.email);
  const favoriteItems = ((favorites ?? []) as WishlistPreview[])
    .map((item) => nestedName(item.products))
    .filter((product): product is { name: string; slug: string } => Boolean(product));

  return (
    <section className="bg-white/60">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Your Ivoire Shop</p>
          <h2 className="mt-2 text-3xl font-semibold text-forest-green">Welcome back, {name}</h2>
          <p className="mt-4 leading-7 text-muted">
            Your recent groceries, favorites, and delivery details — ready for the next order.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <HubLink href="#recent-orders" label="Recent orders" />
          <HubLink href="/account#order-history" label="Order history" />
          <HubLink href="/wishlist" label="Favorites" />
          <HubLink href="/account#addresses" label="Saved addresses" />
          <HubLink href="/account" label="Account" />
          <HubLink href="/shop" label="Continue shopping" />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div id="recent-orders">
            <h3 className="text-xl font-semibold text-forest-green">Recent orders</h3>
            {orders?.length ? (
              <div className="mt-4 grid gap-4">
                {orders.map((order) => <CustomerOrderCard key={order.id} order={order} />)}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-dashed border-forest-green/20 bg-[#f7f3ee] p-6">
                <p className="font-semibold text-forest-green">Your first order is waiting.</p>
                <Link className="mt-3 inline-flex rounded-lg bg-forest-green px-4 py-2.5 text-sm font-semibold text-white" href="/shop">
                  Start shopping
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <article className="rounded-[24px] border border-black/10 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Favorites</p>
              {favoriteItems.length ? (
                <ul className="mt-4 space-y-2">
                  {favoriteItems.map((product) => (
                    <li key={product.slug}>
                      <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href={`/product/${product.slug}`}>
                        {product.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">Save products you love for your next order.</p>
              )}
              <Link className="mt-4 inline-flex text-sm font-semibold text-forest-green underline underline-offset-4" href={favoriteItems.length ? "/wishlist" : "/shop"}>
                {favoriteItems.length ? "View favorites" : "Browse products"}
              </Link>
            </article>

            <article className="rounded-[24px] border border-black/10 bg-white p-6" id="saved-addresses">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Saved addresses</p>
              {(addresses as AddressPreview[] | null)?.length ? (
                <div className="mt-4 space-y-3">
                  {(addresses as AddressPreview[]).map((address) => (
                    <div className="rounded-xl bg-[#f7f3ee] p-4 text-sm text-muted" key={address.id}>
                      <p className="font-semibold text-forest-green">
                        {address.full_name}{address.is_default ? " · Default" : ""}
                      </p>
                      <p>{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}</p>
                      <p>{[address.city, address.state, address.postal_code].filter(Boolean).join(", ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">Add a delivery address for faster checkout.</p>
              )}
              <Link className="mt-4 inline-flex text-sm font-semibold text-forest-green underline underline-offset-4" href="/account#addresses">
                Manage addresses
              </Link>
            </article>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-semibold text-forest-green">How should we send your next order?</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Choose delivery or pickup. We’ll remember this when you check out.
          </p>
          <div className="mt-5">
            <FulfillmentMethodCards />
          </div>
        </div>
      </div>
    </section>
  );
}

function HubLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-full border border-forest-green/15 bg-white px-4 py-2 text-sm font-semibold text-forest-green" href={href}>
      {label}
    </Link>
  );
}
