import Link from "next/link";
import { Footer } from "@/src/components/layout/footer";
import { Header } from "@/src/components/layout/header";

export default function BlogPage() {
  return <><Header /><main className="flex flex-1 items-center justify-center px-5 py-24 text-center"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Ivoire Shop</p><h1 className="mt-3 text-4xl font-semibold text-forest-green">Stories &amp; Inspiration</h1><p className="mt-4 text-muted">Coming soon.</p><Link className="mt-7 inline-flex rounded-lg border border-forest-green/20 px-5 py-3 text-sm font-semibold text-forest-green" href="/">← Back to Home</Link></div></main><Footer /></>;
}
