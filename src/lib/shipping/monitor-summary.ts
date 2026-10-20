export function summarizeShippingEvents(rows: Array<{ event_type: string; payload: Record<string, unknown> | null; created_at: string }>) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.event_type] = (counts[row.event_type] ?? 0) + 1;
  const lastFailure = rows.find((row) => row.event_type === "quote_failure");
  const reason = lastFailure?.payload && typeof lastFailure.payload.reason === "string"
    ? lastFailure.payload.reason
    : null;
  return {
    total: rows.length,
    quoteFailures: counts.quote_failure ?? 0,
    missingParcel: counts.missing_parcel ?? 0,
    exceptions: counts.shipping_exception ?? 0,
    quotes: counts.checkout_quote ?? 0,
    labelsBlocked: counts.label_blocked ?? 0,
    latestAt: rows[0]?.created_at ?? null,
    lastFailureReason: reason,
    lastFailureAt: lastFailure?.created_at ?? null,
  };
}
