"use client";

import { useEffect } from "react";
import { rememberGuestOrderToken } from "@/src/lib/checkout/guest-order-storage";

/** Persist the guest access token in this browser after a successful confirmation. */
export function RememberGuestOrder({ token }: { token?: string | null }) {
  useEffect(() => {
    if (token) rememberGuestOrderToken(token);
  }, [token]);
  return null;
}
