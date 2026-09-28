import "server-only";

import { getEmailProviderStatus } from "@/src/lib/email/send";
import {
  notificationEventFromOrderStatus,
  notificationEventFromPaymentStatus,
  type NotificationEvent,
} from "./events";

type NotificationClient = {
  rpc: (name: string, args: Record<string, unknown>) => unknown;
};

export type CustomerNotification = {
  id: string;
  order_id: string;
  event_type: string;
  title: string;
  message: string;
  confirmation_code: string | null;
  email_sent: boolean;
  email_attempted: boolean;
  read_at: string | null;
  created_at: string;
};

export async function recordCustomerNotification(
  supabase: NotificationClient,
  orderId: string,
  event: NotificationEvent,
  emailSent = false,
) {
  try {
    const { error } = await Promise.resolve(supabase.rpc("create_customer_order_notification", {
      p_order_id: orderId,
      p_event_type: event,
      p_email_sent: emailSent,
    })) as { error: { message?: string } | null };
    if (error) console.error("[order-notification] skipped", { reason: "rpc_failed" });
  } catch (error) {
    console.error("[order-notification] skipped", {
      detail: error instanceof Error ? error.message.slice(0, 180) : "unknown",
    });
  }
}

export async function recordCheckoutNotifications(
  supabase: NotificationClient,
  orderId: string,
  paymentStatus: string | undefined,
  emailSent: boolean,
  signedIn: boolean,
) {
  if (!signedIn) return;
  await recordCustomerNotification(supabase, orderId, "order_confirmed", emailSent);
  const paymentEvent = notificationEventFromPaymentStatus(paymentStatus ?? "pending");
  if (paymentEvent) await recordCustomerNotification(supabase, orderId, paymentEvent, paymentEvent === "payment_received" && emailSent);
}

export async function recordFulfillmentNotification(
  supabase: NotificationClient,
  orderId: string,
  status: string,
  emailSent = false,
) {
  const event = notificationEventFromOrderStatus(status);
  if (!event) return;
  await recordCustomerNotification(supabase, orderId, event, emailSent);
}

export async function recordPaymentNotification(
  supabase: NotificationClient,
  orderId: string,
  paymentStatus: string,
  emailSent = false,
) {
  const event = notificationEventFromPaymentStatus(paymentStatus);
  if (!event || event === "payment_pending") return;
  await recordCustomerNotification(supabase, orderId, event, emailSent);
}

export function notificationEmailSummary(rows: { event_type: string; email_sent: boolean }[]) {
  const email = getEmailProviderStatus();
  return {
    inApp: rows.map((row) => row.event_type),
    emailConfigured: email.configured,
    emailProvider: email.provider,
    anyEmailSent: rows.some((row) => row.email_sent),
  };
}
