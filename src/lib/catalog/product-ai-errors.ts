export const PRODUCT_AI_FAILURE = "AI couldn't fill this product. You can enter the details manually or try again.";

export type ProductAiFailureCode =
  | "IMAGE_FETCH_FAILED"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_RESPONSE_INVALID"
  | "UNKNOWN";

export function newAiAssistReference() {
  const bytes = new Uint8Array(2);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 256);
    bytes[1] = Math.floor(Math.random() * 256);
  }
  return `AI-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

const PRODUCT_AI_FAILURE_BY_CODE: Record<ProductAiFailureCode, string> = {
  IMAGE_FETCH_FAILED: "AI couldn't read this product photo. Confirm the saved image is visible in Admin, then try again.",
  AI_NOT_CONFIGURED: "AI filling is not configured on this environment.",
  AI_AUTH_FAILED: "AI filling could not authenticate with the AI Gateway.",
  AI_RATE_LIMITED: "AI filling is temporarily rate-limited. Wait a minute and try again.",
  AI_TIMEOUT: "AI filling timed out before it finished. Try again.",
  AI_RESPONSE_INVALID: "AI returned details that could not be used. Try again or enter them manually.",
  UNKNOWN: PRODUCT_AI_FAILURE,
};

export function productAiFailureMessage(reference: string, code?: ProductAiFailureCode) {
  const detail = (code && PRODUCT_AI_FAILURE_BY_CODE[code]) || PRODUCT_AI_FAILURE;
  return `${detail} Reference: ${reference}`;
}

export function productAiGatewayReady() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1");
}

export function classifyProductAiError(error: unknown): ProductAiFailureCode {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const cause = record.cause && typeof record.cause === "object" ? (record.cause as Record<string, unknown>) : {};
  const name = [record.name, cause.name].filter((value) => typeof value === "string").join(" ");
  const status = Number(record.statusCode ?? record.status ?? cause.statusCode ?? cause.status);
  const message = [record.message, cause.message].filter((value) => typeof value === "string").join(" ");

  if (/TimeoutError|AbortError/i.test(name) || /timed out|aborted/i.test(message)) return "AI_TIMEOUT";
  if (Number.isFinite(status)) {
    if (status === 401 || status === 403 || status === 402) return "AI_AUTH_FAILED";
    if (status === 429) return "AI_RATE_LIMITED";
    if (status === 408 || status === 504) return "AI_TIMEOUT";
  }
  if (/LoadAPIKeyError|AI_LoadAPIKeyError/i.test(name) || message === "AI_NOT_CONFIGURED") return "AI_NOT_CONFIGURED";
  if (/GatewayAuthenticationError|AI_GatewayAuthenticationError/i.test(name)) return "AI_AUTH_FAILED";
  if (/ProductAiResponseInvalid/i.test(name)) return "AI_RESPONSE_INVALID";
  if (/unauthorized|invalid api key|authentication/i.test(message)) return "AI_AUTH_FAILED";
  return "UNKNOWN";
}

export function logProductAiEvent(input: {
  reference: string;
  step: string;
  code?: ProductAiFailureCode | string;
  extra?: string;
}) {
  console.error(
    `[AI_PRODUCT_ASSIST] ref=${input.reference} step=${input.step} code=${input.code ?? ""} ${input.extra ?? ""}`.trim(),
  );
}
