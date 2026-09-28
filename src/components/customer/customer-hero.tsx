import Image from "next/image";
import Link from "next/link";

export function CustomerHero({ firstName }: { firstName: string | null }) {
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-forest-green">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="order-2 px-6 py-10 sm:px-10 sm:py-14 lg:order-1 lg:flex lg:flex-col lg:justify-center lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Your Ivoire Shop</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-white sm:text-5xl">{greeting}</h1>
          <p className="mt-4 max-w-md leading-7 text-white/80">
            Pick up where you left off — your favorites, your orders, and fresh picks are all here.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="min-h-11 rounded-lg bg-white px-6 py-3.5 text-center text-sm font-semibold text-forest-green shadow-[0_15px_35px_rgba(0,0,0,0.18)]"
              href="/shop"
            >
              Shop Products
            </Link>
            <Link
              className="min-h-11 rounded-lg border border-white/40 bg-white/10 px-6 py-3.5 text-center text-sm font-semibold text-white"
              href="/wishlist"
            >
              View Wishlist
            </Link>
          </div>
        </div>
        <div className="relative order-1 aspect-[4/3] min-h-[220px] lg:order-2 lg:aspect-auto lg:min-h-[360px]">
          <Image
            alt="Customer with groceries planning a shop at home"
            className="object-cover object-[center_20%]"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            src="/images/customer-account-lifestyle.png"
          />
        </div>
      </div>
    </section>
  );
}
