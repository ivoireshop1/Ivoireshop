export const DEFAULT_STORE_TIMEZONE = "America/New_York";

export function storeTimeZone() {
  return process.env.NEXT_PUBLIC_STORE_TIMEZONE || DEFAULT_STORE_TIMEZONE;
}

export function hourInTimeZone(date: Date, timeZone: string) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Unable to read the store-local hour.");
  }
  return hour;
}

export function storeGreetingFromHour(hour: number) {
  if (hour >= 5 && hour <= 11) return "Good morning";
  if (hour >= 12 && hour <= 16) return "Good afternoon";
  if (hour >= 17 && hour <= 21) return "Good evening";
  return "Good night";
}

export function storeGreetingAt(date: Date, timeZone = storeTimeZone()) {
  return storeGreetingFromHour(hourInTimeZone(date, timeZone));
}

export function formatInStoreTimeZone(date: Date | string, timeZone = storeTimeZone()) {
  return formatStoreDateTime(date, timeZone);
}

export function formatStoreDate(date: Date | string, timeZone = storeTimeZone()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(toDate(date));
}

export function formatStoreTime(date: Date | string, timeZone = storeTimeZone()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(date));
}

export function formatStoreDateTime(date: Date | string, timeZone = storeTimeZone()) {
  return `${formatStoreDate(date, timeZone)} at ${formatStoreTime(date, timeZone)}`;
}

export function formatStoreCompact(date: Date | string, timeZone = storeTimeZone()) {
  const value = toDate(date);
  return `${formatStoreShortDate(value, timeZone)}, ${formatStoreTime(value, timeZone)}`;
}

export function formatStoreShortDate(date: Date | string, timeZone = storeTimeZone()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(toDate(date));
}

function toDate(date: Date | string) {
  return typeof date === "string" ? new Date(date) : date;
}

export function startOfStoreDayIso(date = new Date(), timeZone = storeTimeZone()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const windowStart = date.getTime() - 40 * 60 * 60 * 1000;
  for (let stamp = windowStart; stamp <= date.getTime() + 2 * 60 * 60 * 1000; stamp += 60 * 1000) {
    const candidate = new Date(stamp);
    const sameDay =
      new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(candidate) ===
      ymd;
    if (sameDay && hourInTimeZone(candidate, timeZone) === 0) {
      const minute = Number(
        new Intl.DateTimeFormat("en-US", { timeZone, minute: "numeric" }).formatToParts(candidate).find((part) => part.type === "minute")
          ?.value,
      );
      if (minute === 0) return candidate.toISOString();
    }
  }
  return new Date(date.getTime() - 12 * 60 * 60 * 1000).toISOString();
}
