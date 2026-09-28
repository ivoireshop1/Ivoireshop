import { pageMetadata } from "@/src/lib/page-metadata";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import LogoutButton from "@/src/components/auth/logout-button";
import { ChangePasswordForm } from "@/src/components/auth/change-password-form";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";
import { CustomerHero } from "@/src/components/customer/customer-hero";
import { CustomerAccountNav } from "@/src/components/customer/customer-account-nav";
import { CustomerOrderCard } from "@/src/components/customer/customer-order-card";
import { AddAddressForm } from "@/src/components/customer/add-address-form";
import { toOneRelation } from "@/src/lib/catalog/relation-utils";
import { getProducts } from "@/src/lib/catalog/catalog";

type WishlistPreviewProduct = {
  name: string;
  slug: string;
  price: number | string;
  stock_quantity: number | null;
  categories: { name: string } | { name: string }[] | null;
  product_images: { image_url: string; position: number }[] | null;
};

type WishlistPreviewRow = {
  id: string;
  products: WishlistPreviewProduct | WishlistPreviewProduct[] | null;
};

export const metadata = pageMetadata("Your Account", "Manage your account and view your orders.", "/account", false);

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [{ data: profile }, { data: orders, error: ordersError }, { data: addresses }, { data: wishlistRows }, recommended] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_status, total, fulfillment_method, created_at, order_items(product_name, quantity)").eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("addresses")
      .select("id, full_name, address_line_1, address_line_2, city, state, postal_code, country, is_default")
      .order("is_default", { ascending: false })
      .limit(8),
    supabase
      .from("wishlist_items")
      .select("id, product_id, products(name, slug, price, stock_quantity, categories(name), product_images(image_url, position))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4),
    getProducts(),
  ]);
  if (ordersError) throw new Error("Unable to load your orders.");
  const heroName = profile?.full_name?.trim()?.split(/\s+/)[0] || null;
  const recent = orders?.slice(0, 3) ?? [];
  const history = orders?.slice(3) ?? [];
  const wishlistPreview = ((wishlistRows ?? []) as WishlistPreviewRow[])
    .map((row) => toOneRelation(row.products))
    .filter((product): product is WishlistPreviewProduct => Boolean(product));
  const recommendedProducts = recommended.slice(0, 4);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <CustomerAccountNav />
        <CustomerHero firstName={heroName} />

        <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction href="/shop" label="Shop" />
          <QuickAction href="/wishlist" label="Wishlist" />
          <QuickAction href="#recent-orders" label="Orders" />
          <QuickAction href="#security" label="Security" />
        </section>

        <section className="mt-12" id="wishlist-preview">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-forest-green">Your wishlist</h2>
              <p className="mt-1 text-sm text-muted">Saved favorites, ready when you are.</p>
            </div>
            <Link className="text-sm font-semibold text-forest-green underline underline-offset-4" href="/wishlist">
              View all
            </Link>
          </div>
          {wishlistPreview.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {wishlistPreview.map((product) => {
                const image = product.product_images?.slice().sort((a, b) => a.position - b.position)[0]?.image_url;
                const category = toOneRelation(product.categories)?.name || "Uncategorized";
                const isSoldOut = Number(product.stock_quantity) === 0;
                return (
                  <Link className="group rounded-xl bg-surface p-3 shadow-sm" href={`/product/${product.slug}`} key={product.slug}>
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-[#eadfce]">
                      {image && <Image alt={product.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 45vw, 22vw" src={image} />}
                      {isSoldOut && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">Sold Out</span>}
                    </div>
                    <p className="mt-3 text-xs text-muted">{category}</p>
                    <p className="mt-1 truncate font-semibold text-forest-green">{product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-forest-green">${Number(product.price).toFixed(2)}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-forest-green/20 bg-[#f7f3ee] p-6">
              <p className="font-semibold text-forest-green">Your wishlist is empty.</p>
              <Link className="mt-3 inline-flex text-sm font-semibold text-forest-green underline underline-offset-4" href="/shop">
                Explore products
              </Link>
            </div>
          )}
        </section>

        {recommendedProducts.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold text-forest-green">Available now</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendedProducts.map((product) => (
                <Link className="group rounded-xl bg-surface p-3 shadow-sm" href={`/product/${product.slug}`} key={product.id}>
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[#eadfce]">
                    {product.image && <Image alt={product.name} className="object-cover transition duration-300 group-hover:scale-105" fill sizes="(max-width: 640px) 45vw, 22vw" src={product.image} />}
                  </div>
                  <p className="mt-3 text-xs text-muted">{product.category}</p>
                  <p className="mt-1 truncate font-semibold text-forest-green">{product.name}</p>
                  <p className="mt-1 text-sm font-semibold text-forest-green">${product.price.toFixed(2)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-sm text-muted">{user.email}</p>

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
        <article className="rounded-2xl border border-black/10 bg-white p-6" id="security">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Security</p>
          <h2 className="mt-2 text-xl font-semibold text-forest-green">Change password</h2>
          <p className="mt-2 text-sm text-muted">Update the password for this signed-in customer account.</p>
          <div className="mt-5">
            <ChangePasswordForm />
          </div>
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
      <Footer />
    </>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link className="rounded-xl border border-[#173f35]/10 bg-white px-4 py-3 text-center text-sm font-semibold text-forest-green shadow-sm transition hover:-translate-y-0.5 hover:border-gold/60" href={href}>
      {label}
    </Link>
  );
}
