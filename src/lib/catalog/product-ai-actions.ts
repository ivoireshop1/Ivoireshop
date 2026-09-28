"use server";

import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { suggestionHasContent, type ProductAiSuggestion } from "@/src/lib/catalog/product-ai";
import { readTrustedProductImage } from "@/src/lib/catalog/product-ai-image";
import { analyzeProductImageWithGateway } from "@/src/lib/catalog/product-ai-vision";
import { resolvePersistedSku } from "@/src/lib/catalog/sku";
import { isTrustedProductImageUrl } from "@/src/lib/catalog/trusted-product-image";

export type FillProductAiResult =
  | {
      success: true;
      suggestions: ProductAiSuggestion;
      sku: string | null;
      skuGenerated: boolean;
      replaceName: boolean;
      categoryName: string;
    }
  | { success: false; error: string };

const FAILURE = "AI couldn't fill this product. You can enter the details manually or try again.";

async function adminClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return null;
  return supabase;
}

export async function fillProductDetailsWithAi(productId: string): Promise<FillProductAiResult> {
  try {
    const supabase = await adminClient();
    if (!supabase) return { success: false, error: "You need to sign in as an admin." };

    const id = String(productId ?? "").trim();
    if (!id) return { success: false, error: FAILURE };

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, sku, is_active, category_id, product_images(image_url, position)")
      .eq("id", id)
      .maybeSingle();

    if (error || !product) return { success: false, error: FAILURE };

    const { data: category } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("id", product.category_id)
      .maybeSingle();
    const categoryName = category?.name;
    const categorySlug = category?.slug;
    if (!categoryName || !categorySlug) return { success: false, error: FAILURE };

    const images = Array.isArray(product.product_images) ? [...product.product_images] : [];
    images.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const imageUrl = images[0]?.image_url ?? "";
    if (!isTrustedProductImageUrl(imageUrl)) return { success: false, error: FAILURE };

    const image = await readTrustedProductImage(imageUrl);
    if (!image) return { success: false, error: FAILURE };

    const suggestions = await analyzeProductImageWithGateway({
      bytes: image.bytes,
      mediaType: image.mediaType,
      categoryName,
      draftName: product.name ?? "",
    });

    if (!suggestionHasContent(suggestions)) return { success: false, error: FAILURE };

    const { data: skuRows } = await supabase.from("products").select("id, sku").not("sku", "is", null);
    const taken = (skuRows ?? [])
      .filter((row) => row.id !== product.id)
      .map((row) => String(row.sku ?? ""))
      .filter(Boolean);
    const sku = resolvePersistedSku({
      existingSku: product.sku,
      submittedSku: null,
      categorySlug,
      productId: product.id,
      takenSkus: taken,
    });

    return {
      success: true,
      suggestions,
      sku: sku.sku,
      skuGenerated: sku.generated,
      replaceName: !product.is_active,
      categoryName,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("fillProductDetailsWithAi failed", error instanceof Error ? error.name : "error");
    return { success: false, error: FAILURE };
  }
}
