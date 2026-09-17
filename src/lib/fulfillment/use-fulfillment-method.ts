"use client";

import { useSyncExternalStore } from "react";
import {
  loadFulfillmentMethod,
  saveFulfillmentMethod,
  subscribeFulfillment,
  type FulfillmentMethod,
} from "./fulfillment";

export function useFulfillmentMethod() {
  const method = useSyncExternalStore(subscribeFulfillment, loadFulfillmentMethod, () => "delivery" as const);

  return [method, saveFulfillmentMethod] as const;
}

export type { FulfillmentMethod };
