"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }
  if (sent) return <div className="rounded-xl border border-forest-green/20 bg-[#f5f0e6] p-6"><h2 className="font-semibold text-forest-green">Thanks for reaching out!</h2><p className="mt-2 text-sm leading-6 text-muted">We&apos;ll get back to you as soon as possible. This is a local demo submission; no message was sent.</p><button className="mt-5 text-sm font-semibold text-forest-green underline underline-offset-4" onClick={() => setSent(false)} type="button">Send another message</button></div>;
  return <form className="space-y-5" onSubmit={submit}>
    <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium text-forest-green">Name<input className="mt-2 w-full rounded-lg border border-black/15 bg-white px-3 py-3 font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" name="name" required /></label><label className="text-sm font-medium text-forest-green">Email<input className="mt-2 w-full rounded-lg border border-black/15 bg-white px-3 py-3 font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" name="email" required type="email" /></label></div>
    <label className="block text-sm font-medium text-forest-green">Subject<input className="mt-2 w-full rounded-lg border border-black/15 bg-white px-3 py-3 font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" name="subject" required /></label>
    <label className="block text-sm font-medium text-forest-green">Message<textarea className="mt-2 min-h-36 w-full rounded-lg border border-black/15 bg-white px-3 py-3 font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" name="message" required /></label>
    <button className="rounded-lg bg-forest-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-deep-green focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" type="submit">Send Message</button>
  </form>;
}
