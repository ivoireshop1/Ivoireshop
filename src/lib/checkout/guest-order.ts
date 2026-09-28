import { createClient } from "@/src/lib/supabase/server";

export async function getGuestOrderConfirmation(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return { kind: "missing" as const };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_checkout_confirmation", { p_access_token: token });
  if (error) throw new Error("Unable to load this confirmation.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) return { kind: "missing" as const };
  return { kind: "found" as const, order: row };
}
