export function OrderMoneyBreakdown({
  subtotal,
  shipping,
  discount,
  tax,
  total,
  compact = false,
}: {
  subtotal: number | string | null | undefined;
  shipping?: number | string | null;
  discount?: number | string | null;
  tax?: number | string | null;
  total: number | string | null | undefined;
  compact?: boolean;
}) {
  const money = (value: number | string | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;
  const row = "flex justify-between gap-4";
  return (
    <dl className={compact ? "space-y-1 text-sm" : "space-y-2 text-sm"}>
      <div className={row}><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      {Number(discount ?? 0) > 0 ? <div className={row}><dt>Discount</dt><dd>-{money(discount)}</dd></div> : null}
      <div className={row}><dt>Shipping / Delivery</dt><dd>{money(shipping)}</dd></div>
      <div className={row}><dt>Tax</dt><dd>{money(tax)}</dd></div>
      <div className={`${row} font-semibold`}><dt>Total</dt><dd>{money(total)}</dd></div>
    </dl>
  );
}
