import "server-only";

import { cache } from "react";
import { createClient } from "@/src/lib/supabase/server";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import {
  emailBrandFromProfile,
  profileFromSettingsRow,
  type StoreEmailBrand,
  type StoreProfile,
} from "@/src/lib/store/profile-shared";

export type { StoreEmailBrand, StoreProfile };
export {
  SUPPORTED_STORE_CURRENCIES,
  isSupportedStoreCurrency,
  isValidSupportEmail,
  isValidWarehousePhone,
  normalizeStoreEmail,
  parseStorefrontUrl,
  storefrontUrlConfigSteps,
  profileFromSettingsRow,
  emailBrandFromProfile,
} from "@/src/lib/store/profile-shared";

export const getStoreProfile = cache(async (): Promise<StoreProfile> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("origin_name, origin_phone, support_email, storefront_url, default_currency")
    .eq("id", STORE_SETTINGS_ID)
    .maybeSingle();
  return profileFromSettingsRow(data as Record<string, unknown> | null);
});

export async function getStoreEmailBrand(): Promise<StoreEmailBrand> {
  return emailBrandFromProfile(await getStoreProfile());
}
