import Link from "next/link";

export function ContactForm() {
  return <div className="rounded-xl border border-forest-green/20 bg-surface p-6"><h2 className="text-xl font-semibold text-forest-green">Contact form unavailable</h2><p className="mt-3 leading-7 text-muted">Online messages are not yet supported. No message or personal information is collected here.</p><Link className="mt-6 inline-flex min-h-11 items-center font-semibold text-forest-green underline underline-offset-4" href="/account">View your account and orders</Link></div>;
}
