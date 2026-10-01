export function fulfillmentDisplay(order: {
  fulfillment_method?: string | null;
  fulfillment_provider?: string | null;
  fulfillment_service?: string | null;
}) {
  if (order.fulfillment_method === "local_pickup") return "Pickup · Store Pickup";
  const provider = (order.fulfillment_provider ?? "").toLowerCase();
  const service = order.fulfillment_service?.trim();
  if (provider === "doordash") return service ? `Local Delivery · DoorDash · ${service}` : "Local Delivery · DoorDash";
  if (provider === "ups") return "Shipping · UPS — Manual Shipping";
  if (provider === "usps") return "Shipping · USPS — Manual Shipping";
  if (provider === "store") return "Delivery · Arranged by Ivoire Shop";
  return order.fulfillment_method === "delivery" ? "Delivery" : "Fulfillment";
}
