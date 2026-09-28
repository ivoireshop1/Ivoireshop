"use server";

import { setStoreOpen } from "@/src/lib/store/status";

export async function openStore() {
  return setStoreOpen(true);
}

export async function closeStore() {
  return setStoreOpen(false);
}
