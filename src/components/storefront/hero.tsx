import Link from "next/link";
import Image from "next/image";
import { demoImages } from "@/src/lib/demo-images";

const trustPillars = ["Freshly sourced", "Fast local delivery", "Secure checkout"];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#efe7dc]">
      <div className="relative min-h-[560px] md:min-h-[640px] lg:min-h-[720px]">
        <Image
          alt="A shopper with fresh produce from Ivoire Shop"
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={demoImages.heroCustomer}
        />

        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,63,53,0.74)_0%,rgba(23,63,53,0.52)_28%,rgba(23,63,53,0.12)_58%,rgba(23,63,53,0.12)_100%)]" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-8">
          <div className="max-w-xl text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f0d694]">African &amp; global essentials</p>
            <h1 className="mt-5 font-serif text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-white sm:text-6xl lg:text-[5.25rem]">
              Better
              <span className="block text-[#f5efdf]">food, brighter</span>
              <span className="block">days.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-white/80 sm:text-lg">
              Discover Ivoire Shop and explore the collection as products become available.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-lg bg-white px-6 py-3.5 text-center text-sm font-semibold text-forest-green shadow-[0_15px_35px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#f7f3ee]"
                href="/shop"
              >
                Shop now <span aria-hidden="true">→</span>
              </Link>
              <Link
                className="rounded-lg border border-white/40 bg-white/10 px-6 py-3.5 text-center text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/15"
                href="#categories"
              >
                Explore categories
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {trustPillars.map((pillar) => (
                <span
                  key={pillar}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/90 backdrop-blur-sm"
                >
                  {pillar}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
