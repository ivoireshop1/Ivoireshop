function text(name: string) {
  return (process.env[name] ?? "").trim();
}

export function doordashCredentials() {
  const developerId = text("DOORDASH_DEVELOPER_ID");
  const keyId = text("DOORDASH_KEY_ID");
  const signingSecret = text("DOORDASH_SIGNING_SECRET");
  return {
    configured: Boolean(developerId && keyId && signingSecret),
    developerId,
    keyId,
    signingSecret,
  };
}

export function upsCredentials() {
  const clientId = text("UPS_CLIENT_ID");
  const clientSecret = text("UPS_CLIENT_SECRET");
  const accountNumber = text("UPS_ACCOUNT_NUMBER");
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    accountNumber,
  };
}

export function uspsCredentials() {
  const consumerKey = text("USPS_CONSUMER_KEY");
  const consumerSecret = text("USPS_CONSUMER_SECRET");
  return {
    configured: Boolean(consumerKey && consumerSecret),
    consumerKey,
    consumerSecret,
  };
}

import {
  UBER_DIRECT_PRODUCTION_DISPATCH_FLAG,
  credentialStatusSummary,
  explainUberCheckoutBlocker,
  explainUberDispatchBlocker,
  uberDirectCredentials,
  uberDirectEnvironment,
  uberDispatchAllowed,
  uberQuotesAllowed,
} from "./providers/uber-direct";

export {
  UBER_DIRECT_PRODUCTION_DISPATCH_FLAG,
  credentialStatusSummary,
  explainUberCheckoutBlocker,
  explainUberDispatchBlocker,
  uberDirectCredentials,
  uberDirectEnvironment,
  uberDispatchAllowed,
  uberQuotesAllowed,
};
export type { UberEnvironment, UberSettingsGate } from "./providers/uber-direct";

export type ProviderId = "doordash" | "ups" | "usps" | "uber";

export function providerCredentialState(provider: ProviderId) {
  if (provider === "doordash") return doordashCredentials().configured;
  if (provider === "uber") return uberDirectCredentials().configured && uberDirectEnvironment() !== "unidentified";
  if (provider === "ups") return upsCredentials().configured;
  return uspsCredentials().configured;
}
