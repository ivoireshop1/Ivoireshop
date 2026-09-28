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

export function productAiFailureMessage(reference: string) {
  return `${PRODUCT_AI_FAILURE} Reference: ${reference}`;
}

export function productAiGatewayReady() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1");
}

export function classifyProductAiError(error: unknown): ProductAiFailureCode {
  const record = error && typeof error === "object" ? (error as { name?: unknown; statusCode?: unknown }) : null;
  const name = typeof record?.name === "string" ? record.name : "";
  const status = Number(record?.statusCode);

  if (name === "TimeoutError" || name === "AbortError") return "AI_TIMEOUT";
  if (Number.isFinite(status)) {
    if (status === 401 || status === 403) return "AI_AUTH_FAILED";
    if (status === 429) return "AI_RATE_LIMITED";
    if (status === 408 || status === 504) return "AI_TIMEOUT";
    if (status === 402) return "AI_AUTH_FAILED";
  }
  if (name === "AI_LoadAPIKeyError" || name === "LoadAPIKeyError") return "AI_NOT_CONFIGURED";
  if (name === "ProductAiResponseInvalid") return "AI_RESPONSE_INVALID";
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
