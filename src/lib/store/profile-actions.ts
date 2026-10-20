"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/auth/guards";
import { STORE_SETTINGS_ID } from "@/src/lib/store/constants";
import {
  isSupportedStoreCurrency,
  isValidSupportEmail,
  isValidWarehousePhone,
  normalizeStoreEmail,
  parseStorefrontUrl,
  storefrontUrlConfigSteps,
} from "@/src/lib/store/profile-shared";

export type SaveStoreDetailsState = {
  saved?: boolean;
  error?: string;
  notices?: string[];
  draft?: {
    storeName: string;
    storefrontUrl: string;
    defaultCurrency: string;
    supportEmail: string;
    warehousePhone: string;
  };
};

function draftFromForm(formData: FormData): SaveStoreDetailsState["draft"] {
  return {
    storeName: String(formData.get("store_name") ?? "").trim(),
    storefrontUrl: String(formData.get("storefront_url") ?? "").trim(),
    defaultCurrency: String(formData.get("default_currency") ?? "").trim().toUpperCase(),
    supportEmail: String(formData.get("support_email") ?? "").trim(),
    warehousePhone: String(formData.get("warehouse_phone") ?? "").trim(),
  };
}

export async function saveStoreDetails(
  _prev: SaveStoreDetailsState | null,
  formData: FormData,
): Promise<SaveStoreDetailsState> {
  const draft = draftFromForm(formData);
  const { supabase, user } = await requireAdmin();

  if (!draft?.storeName || draft.storeName.length < 2) {
    return { error: "Enter a store name (at least 2 characters).", saved: false, draft };
  }
  if (draft.storeName.length > 80) {
    return { error: "Store name must be 80 characters or fewer.", saved: false, draft };
  }

  const urlParsed = parseStorefrontUrl(draft.storefrontUrl);
  if (!urlParsed.ok) {
    return { error: urlParsed.error, saved: false, draft };
  }

  if (!isSupportedStoreCurrency(draft.defaultCurrency)) {
    return {
      error:
        "Only USD is supported right now. Stripe, PayPal, Square, and existing order totals are USD. Changing currency would require a migration — activation is blocked.",
      saved: false,
      draft,
    };
  }

  const supportEmail = normalizeStoreEmail(draft.supportEmail);
  if (!isValidSupportEmail(supportEmail)) {
    return { error: "Enter a valid support email, or leave it blank.", saved: false, draft };
  }

  if (!isValidWarehousePhone(draft.warehousePhone)) {
    return { error: "Enter a valid warehouse phone (7–15 digits), or leave it blank.", saved: false, draft };
  }

  const values = {
    origin_name: draft.storeName,
    storefront_url: urlParsed.url,
    default_currency: draft.defaultCurrency,
    support_email: supportEmail || null,
    origin_phone: draft.warehousePhone,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const { data, error } = await supabase
    .from("store_settings")
    .update(values)
    .eq("id", STORE_SETTINGS_ID)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      error: "Couldn’t save store details. Your draft is preserved below — try again.",
      saved: false,
      draft: { ...draft, storefrontUrl: urlParsed.url, supportEmail },
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/delivery");
  revalidatePath("/contact");
  revalidatePath("/checkout");
  revalidatePath("/admin/print");

  return {
    saved: true,
    notices: storefrontUrlConfigSteps(urlParsed.url),
    draft: { ...draft, storefrontUrl: urlParsed.url, supportEmail },
  };
}
