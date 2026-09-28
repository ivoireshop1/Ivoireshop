"use client";

import Link from "next/link";

export default function ProductErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold text-forest-green">We couldn&apos;t load this product</h1>
      <p role="alert" className="mt-4 text-muted">Please try again. Your review and cart were not lost.</p>
      <button className="mt-8 rounded-lg bg-forest-green px-6 py-3 font-semibold text-white" onClick={reset} type="button">Try again</button>
      <Link className="ml-5 underline" href="/shop">Back to shop</Link>
    </main>
  );
}
