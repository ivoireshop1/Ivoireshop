import type { PaymentEnvironment } from "./public";

export type { PaymentEnvironment } from "./public";
export { squareWebSdkUrl } from "./public";

function text(name: string) {
  return (process.env[name] ?? "").trim();
}

function environment(value: string): PaymentEnvironment | null {
  if (value === "sandbox" || value === "production") return value;
  return null;
}

export function getSquareConfig() {
  const applicationId = text("SQUARE_APPLICATION_ID") || text("NEXT_PUBLIC_SQUARE_APPLICATION_ID");
  const locationId = text("SQUARE_LOCATION_ID") || text("NEXT_PUBLIC_SQUARE_LOCATION_ID");
  const accessToken = text("SQUARE_ACCESS_TOKEN");
  const env = environment(text("SQUARE_ENVIRONMENT"));
  const webhookSignatureKey = text("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const configured = Boolean(applicationId && locationId && accessToken && env);
  return {
    applicationId,
    locationId,
    accessToken,
    environment: env,
    webhookSignatureKey,
    configured,
    public: {
      applicationId,
      locationId,
      environment: env,
    },
  };
}

export function getPaypalConfig() {
  const clientId = text("PAYPAL_CLIENT_ID") || text("NEXT_PUBLIC_PAYPAL_CLIENT_ID");
  const clientSecret = text("PAYPAL_CLIENT_SECRET");
  const env = environment(text("PAYPAL_ENVIRONMENT"));
  const webhookId = text("PAYPAL_WEBHOOK_ID");
  const configured = Boolean(clientId && clientSecret && env);
  return {
    clientId,
    clientSecret,
    environment: env,
    webhookId,
    configured,
    public: {
      clientId,
      environment: env,
    },
  };
}

export function hasPaymentAdminClient() {
  return Boolean(text("NEXT_PUBLIC_SUPABASE_URL") && text("SUPABASE_SERVICE_ROLE_KEY"));
}

export function paypalApiBase(environment: PaymentEnvironment) {
  return environment === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function squareApiBase(environment: PaymentEnvironment) {
  return environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
}
