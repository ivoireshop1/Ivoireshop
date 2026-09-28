export const PRODUCT_AI_FAILURE = "AI couldn't fill this product. You can enter the details manually or try again.";

export type ProductAiFailureCode =
  | "IMAGE_FETCH_FAILED"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_RESPONSE_INVALID"
  | "UNKNOWN";

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

export function logProductAiFailure(code: ProductAiFailureCode, extra?: string) {
  console.error("fillProductDetailsWithAi", code, extra ?? "");
}
