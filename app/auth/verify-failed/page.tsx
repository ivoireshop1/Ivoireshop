import Link from "next/link";
import { pageMetadata } from "@/src/lib/page-metadata";

export const metadata = pageMetadata("Verification needed", "Your Ivoire Shop confirmation link could not be completed.", "/auth/verify-failed", false);

export default function VerifyFailedPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Ivoire Shop</p>
      <h1 className="mt-3 text-3xl font-semibold text-forest-green">Verification link couldn&apos;t be completed</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        This confirmation link is invalid or expired. Return to Sign In, or request a new confirmation email.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="min-h-11 rounded-lg bg-forest-green px-4 py-2 text-sm font-semibold text-white" href="/login">
          Return to Sign In
        </Link>
        <Link className="min-h-11 rounded-lg border border-forest-green/20 px-4 py-2 text-sm font-semibold text-forest-green" href="/signup/check-email">
          Request a new confirmation email
        </Link>
      </div>
    </main>
  );
}
