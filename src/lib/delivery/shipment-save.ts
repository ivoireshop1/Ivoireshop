export type ShipmentSaveIntent = "tracking" | "ship";

export function shipmentSaveIntent(value: unknown): ShipmentSaveIntent {
  return String(value ?? "") === "ship" ? "ship" : "tracking";
}

export function shipmentSavePatch(input: {
  intent: ShipmentSaveIntent;
  tracking: string;
  alreadyShipped: boolean;
  postage: number | null;
  demo: boolean;
  shippedAt: string;
}) {
  const patch: Record<string, unknown> = { tracking_number: input.tracking };
  if (input.postage != null && !input.demo) patch.postage_cost = input.postage;
  if (input.intent === "ship" && !input.alreadyShipped) {
    patch.status = "shipped";
    patch.shipped_at = input.shippedAt;
  }
  return patch;
}

export function shipmentMarksShipped(intent: ShipmentSaveIntent, alreadyShipped: boolean) {
  return intent === "ship" && !alreadyShipped;
}
