const USD_CENTS = /^(\d+)\.(\d{2})$/;
const USD_WHOLE = /^(\d+)$/;

export function usdToCents(value: string | number): number {
  const normalized =
    typeof value === "number"
      ? Number.isFinite(value) && value >= 0
        ? value.toFixed(2)
        : ""
      : String(value).trim();
  const match = USD_CENTS.exec(normalized) ?? USD_WHOLE.exec(normalized);
  if (!match) throw new Error("Invalid USD amount.");
  const dollars = Number(match[1]);
  const cents = match[2] ? Number(match[2]) : 0;
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents) || cents > 99) {
    throw new Error("Invalid USD amount.");
  }
  const total = dollars * 100 + cents;
  if (total < 0 || !Number.isSafeInteger(total)) throw new Error("Invalid USD amount.");
  return total;
}

export function centsToUsdString(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid cent amount.");
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${String(remainder).padStart(2, "0")}`;
}

export function amountsMatchUsd(expected: string | number, received: string | number): boolean {
  try {
    return usdToCents(expected) === usdToCents(received);
  } catch {
    return false;
  }
}
