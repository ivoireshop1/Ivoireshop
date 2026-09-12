"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | undefined;

export function createClient() {
  if (client) {
    return client;
  }

  const { url, anonKey } = getSupabaseConfig();
  client = createBrowserClient(url, anonKey);
  return client;
}
