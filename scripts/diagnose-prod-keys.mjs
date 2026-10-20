import { readFileSync, unlinkSync, existsSync } from "node:fs";

const path = ".env.runtime-check";
if (!existsSync(path)) {
  console.error("Missing .env.runtime-check — run vercel env pull first.");
  process.exit(1);
}

const raw = readFileSync(path, "utf8");
unlinkSync(path);

function get(key) {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const match = raw.match(re);
  if (!match) return "";
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\n/g, "\n").trim();
}

function mask(value) {
  if (!value) {
    return { present: false, length: 0, prefix: "", mode: "missing", emptyString: true };
  }
  let mode = "other";
  if (value.startsWith("sk_live") || value.startsWith("pk_live")) mode = "live";
  else if (value.startsWith("sk_test") || value.startsWith("pk_test")) mode = "test";
  else if (value.startsWith("whsec_")) mode = "whsec";
  else if (value.startsWith("shippo_test")) mode = "shippo_test";
  else if (value.startsWith("shippo_live")) mode = "shippo_live";
  else if (value.startsWith("shippo_")) mode = "shippo_other";
  return {
    present: true,
    length: value.length,
    prefix: value.slice(0, 8),
    mode,
    emptyString: false,
  };
}

const keys = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_LIVE_PAYMENTS_ENABLED",
  "SHIPPO_API_TOKEN",
  "NEXT_PUBLIC_SITE_URL",
];

const report = Object.fromEntries(keys.map((key) => [key, mask(get(key))]));
const secret = report.STRIPE_SECRET_KEY;
const publishable = report.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
report.stripeModeMatch =
  secret.present &&
  publishable.present &&
  secret.mode === publishable.mode &&
  (secret.mode === "test" || secret.mode === "live");
report.livePaymentsFlag = get("STRIPE_LIVE_PAYMENTS_ENABLED").toLowerCase() === "true";

console.log(JSON.stringify(report, null, 2));
