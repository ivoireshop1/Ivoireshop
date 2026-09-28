import Image from "next/image";
import Link from "next/link";
import { getActiveStorefrontBillboard } from "@/src/lib/admin/announcements";
import { safeStorefrontPath } from "@/src/lib/storefront/cta";

export async function StorefrontBillboard() {
  const billboard = await getActiveStorefrontBillboard();
  if (!billboard) return null;
  const href = safeStorefrontPath(billboard.cta_destination);
  return (
    <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
      <div className="grid overflow-hidden rounded-[28px] border border-black/10 bg-[#fffdf9] shadow-[0_18px_40px_rgba(23,63,53,0.06)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-6 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{billboard.badge}</p>
          <h2 className="mt-3 text-3xl font-semibold text-forest-green">{billboard.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted">{billboard.description}</p>
          <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white" href={href}>
            {billboard.cta_label}
          </Link>
        </div>
        {billboard.image_url ? (
          <div className="relative min-h-[200px] bg-[#eadfce]">
            <Image alt="" className="object-cover" fill sizes="(max-width: 1024px) 100vw, 40vw" src={billboard.image_url} unoptimized />
          </div>
        ) : null}
      </div>
    </section>
  );
}
