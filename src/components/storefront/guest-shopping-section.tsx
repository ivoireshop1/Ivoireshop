import Link from "next/link";
import { createClient } from "@/src/lib/supabase/server";
import { CustomerHub } from "@/src/components/customer/customer-hub";

const options = [
  {
    eyebrow: "No account needed",
    title: "Shop as guest",
    copy: "Browse products, build your cart, and start shopping right away.",
    href: "/shop",
    label: "Shop as guest",
    featured: true,
  },
  {
    eyebrow: "Make it yours",
    title: "Create an account",
    copy: "Save favorites, manage orders, and enjoy a more personal experience.",
    href: "/signup",
    label: "Create account",
    featured: false,
  },
  {
    eyebrow: "Welcome back",
    title: "Sign in",
    copy: "Already have an account? Pick up where you left off.",
    href: "/login",
    label: "Sign in",
    featured: false,
  },
];

export async function GuestShoppingSection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return <CustomerHub />;

  return (
    <section className="bg-white/60">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Choose your experience</p>
          <h2 className="mt-2 text-3xl font-semibold text-forest-green">Start shopping your way</h2>
          <p className="mt-4 leading-7 text-muted">
            Start browsing as a guest, or create an account when you&apos;re ready for a more tailored experience.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {options.map((option) => (
            <article
              className={`flex flex-col justify-between rounded-[26px] border p-6 shadow-[0_18px_35px_rgba(23,63,53,0.04)] ${
                option.featured ? "border-forest-green bg-forest-green text-white" : "border-black/10 bg-[#f7f3ee]"
              }`}
              key={option.title}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">{option.eyebrow}</p>
                <h3 className={`mt-4 text-2xl font-semibold ${option.featured ? "text-white" : "text-forest-green"}`}>
                  {option.title}
                </h3>
                <p className={`mt-3 text-sm leading-6 ${option.featured ? "text-white/75" : "text-muted"}`}>
                  {option.copy}
                </p>
              </div>

              <Link
                className={`mt-8 inline-flex w-fit rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  option.featured
                    ? "bg-white text-forest-green hover:bg-white/90"
                    : "border border-forest-green text-forest-green hover:bg-forest-green/5"
                }`}
                href={option.href}
              >
                {option.label}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
