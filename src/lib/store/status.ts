import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import { formatInStoreTimeZone } from "@/src/lib/store/timezone";

export { STORE_CLOSED_MESSAGE, STORE_SETTINGS_ID } from "@/src/lib/store/constants";

export type StoreStatus = {
  isOpen: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function getStoreStatus(): Promise<StoreStatus> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("is_open, updated_at, updated_by")
    .eq("id", STORE_SETTINGS_ID)
    .maybeSingle();
  return {
    isOpen: data?.is_open !== false,
    updatedAt: data?.updated_at ?? null,
    updatedBy: data?.updated_by ?? null,
  };
}

export async function isStoreOpen() {
  const status = await getStoreStatus();
  return status.isOpen;
}

export function describeStoreStatus(status: StoreStatus) {
  const changed = status.updatedAt ? `Last changed ${formatInStoreTimeZone(status.updatedAt)}` : "Not changed yet";
  const by = status.updatedBy ? " by an admin" : "";
  return {
    label: status.isOpen ? "Store open" : "Store closed",
    description: `${changed}${by}.`,
    tone: status.isOpen ? ("positive" as const) : ("warning" as const),
  };
}

export async function setStoreOpen(nextOpen: boolean) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("store_settings").upsert({
    id: STORE_SETTINGS_ID,
    is_open: nextOpen,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return { success: false as const, error: "Could not update store status." };
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/checkout");
  revalidatePath("/cart");
  return { success: true as const, isOpen: nextOpen };
}
