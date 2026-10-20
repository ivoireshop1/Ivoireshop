export const IVOIRE_WEBHOOK_SELF_SIGNED_EVENT_TYPE = "ivoire.diagnostic.webhook_self_signed";

export function isIvoireWebhookSelfSignedEvent(type: string | null | undefined) {
  return type === IVOIRE_WEBHOOK_SELF_SIGNED_EVENT_TYPE;
}
