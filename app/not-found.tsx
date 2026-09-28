import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto max-w-2xl px-5 py-24 text-center"><h1 className="text-3xl font-semibold text-forest-green">Page not found</h1><p className="mt-4 text-muted">This page or product is no longer available.</p><Link className="mt-8 inline-flex rounded-lg bg-forest-green px-6 py-3 font-semibold text-white" href="/shop">Browse the shop</Link></main>;
}
