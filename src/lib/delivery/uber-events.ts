import { createAdminClient } from "@/src/lib/supabase/admin";
import { sanitizeProviderError } from "./types";
import type { UberEnvironment } from "./providers/uber-direct";

export type UberQuoteEventKind = "quote_success" | "quote_failure" | "connection_check" | "admin_quote";

export async function recordUberQuoteEvent(input: {
  kind: UberQuoteEventKind;
  message?: string | null;
  feeCents?: number | null;
  markupCents?: number | null;
  environment?: UberEnvironment | string | null;
  source?: "checkout" | "admin" | "system";
}) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("uber_quote_events").insert({
      kind: input.kind,
      message: input.message ? sanitizeProviderError(input.message) : null,
      fee_cents: input.feeCents ?? null,
      markup_cents: input.markupCents ?? null,
      environment: input.environment ?? null,
      source: input.source ?? "system",
    });
  } catch {
    console.info("[uber-quote-event]", { kind: input.kind });
  }
}
