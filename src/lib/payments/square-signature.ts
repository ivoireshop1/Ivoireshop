import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySquareWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string;
  signatureKey: string;
  notificationUrl: string;
}): boolean {
  if (!input.rawBody || !input.signatureHeader || !input.signatureKey || !input.notificationUrl) {
    return false;
  }
  const hmac = createHmac("sha256", input.signatureKey);
  hmac.update(input.notificationUrl + input.rawBody);
  const expected = Buffer.from(hmac.digest("base64"));
  let received: Buffer;
  try {
    received = Buffer.from(input.signatureHeader, "utf8");
  } catch {
    return false;
  }
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
