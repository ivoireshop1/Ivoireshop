"use client";

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/browser";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    setStatus("sending");
    setError("");
    const client = createClient();
    const { error: submitError } = await client.rpc("submit_contact_message", {
      p_name: String(formData.get("name") ?? ""),
      p_email: String(formData.get("email") ?? ""),
      p_message: String(formData.get("message") ?? ""),
    });
    if (submitError) {
      setStatus("error");
      setError(submitError.message || "Message could not be sent.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-forest-green/20 bg-surface p-6">
        <h2 className="text-xl font-semibold text-forest-green">Message sent</h2>
        <p className="mt-3 leading-7 text-muted">Thank you. Ivoire Shop received your message and will follow up by email.</p>
      </div>
    );
  }

  return (
    <form action={(formData) => void onSubmit(formData)} className="rounded-xl border border-forest-green/20 bg-surface p-6">
      <h2 className="text-xl font-semibold text-forest-green">Send a message</h2>
      <p className="mt-2 text-sm text-muted">Questions about products or orders are stored for the store team. Do not send payment card numbers.</p>
      <label className="mt-5 block text-sm font-semibold text-forest-green" htmlFor="contact-name">Name</label>
      <input className="mt-1 min-h-11 w-full rounded-lg border border-forest-green/20 px-3" id="contact-name" maxLength={120} name="name" required />
      <label className="mt-4 block text-sm font-semibold text-forest-green" htmlFor="contact-email">Email</label>
      <input className="mt-1 min-h-11 w-full rounded-lg border border-forest-green/20 px-3" id="contact-email" maxLength={254} name="email" required type="email" />
      <label className="mt-4 block text-sm font-semibold text-forest-green" htmlFor="contact-message">Message</label>
      <textarea className="mt-1 min-h-32 w-full rounded-lg border border-forest-green/20 px-3 py-2" id="contact-message" maxLength={2000} name="message" required />
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      <button className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-forest-green px-4 text-sm font-semibold text-white" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
