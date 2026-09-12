import { SmartBackButton } from "@/src/components/navigation/smart-back-button";
import { Suspense } from "react";

export function PageHero({ eyebrow, title, description, fallbackHref = "/", fallbackLabel = "Back to Home" }: { eyebrow: string; title: string; description: string; fallbackHref?: string; fallbackLabel?: string }) {
  return <section className="border-b border-black/10 bg-[#e9e0d0]">
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <Suspense fallback={<span className="inline-flex min-h-10 items-center px-3 py-2 text-sm text-forest-green">← {fallbackLabel}</span>}><SmartBackButton fallbackHref={fallbackHref} fallbackLabel={fallbackLabel} /></Suspense>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-forest-green sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-muted">{description}</p>
    </div>
  </section>;
}
