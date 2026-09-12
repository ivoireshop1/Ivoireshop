"use client";

import { FormEvent, useState } from "react";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) return <p className="mt-4 text-sm text-white/75">Thank you — you&apos;re on the list.</p>;

  return <form className="mt-4 flex max-w-sm" onSubmit={submit}>
    <label className="sr-only" htmlFor="newsletter-email">Email address</label>
    <input className="min-w-0 flex-1 rounded-l-lg border-0 px-3 py-2 text-sm text-foreground outline-none" id="newsletter-email" placeholder="Enter your email address" required type="email" />
    <button className="rounded-r-lg bg-gold px-3 py-2 text-sm font-semibold text-forest-green" type="submit">Subscribe</button>
  </form>;
}
