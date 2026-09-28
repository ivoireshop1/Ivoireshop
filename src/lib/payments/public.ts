export type PaymentEnvironment = "sandbox" | "production";

export function squareWebSdkUrl(environment: PaymentEnvironment) {
  return environment === "production"
    ? "https://web.squarecdn.com/v1/square.js"
    : "https://sandbox.web.squarecdn.com/v1/square.js";
}
