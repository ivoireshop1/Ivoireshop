"use server";

import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import type { ProductAiSuggestion } from "@/src/lib/catalog/product-ai";
import {
  classifyProductAiError,
  logProductAiEvent,
  newAiAssistReference,
  productAiFailureMessage,
  type ProductAiFailureCode,
} from "@/src/lib/catalog/product-ai-errors";
import { publicImageHttpUrl, readTrustedProductImage } from "@/src/lib/catalog/product-ai-image";
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
  | { success: false; error: string; code: ProductAiFailureCode; reference: string };

function shortProductId(id: string) {
  return id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8);
}

function deploymentLabel() {
  return process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "local";
}

function fail(code: ProductAiFailureCode, reference: string, extra?: string): FillProductAiResult {
  logProductAiEvent({ reference, step: "fail", code, extra });
  return { success: false, error: productAiFailureMessage(reference), code, reference };
}

function providerStatus(error: unknown) {
  const record = error && typeof error === "object" ? (error as { name?: unknown; statusCode?: unknown; status?: unknown }) : null;
  const status = Number(record?.statusCode ?? record?.status);
  const name = typeof record?.name === "string" ? record.name : "Error";
  return `providerStatus=${Number.isFinite(status) ? status : "none"} providerName=${name}`;
}

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
  const reference = newAiAssistReference();
  try {
    logProductAiEvent({
      reference,
      step: "start",
      extra: `deployment=${deploymentLabel()}`,
    });

    const supabase = await adminClient();
    if (!supabase) {
      logProductAiEvent({ reference, step: "auth", extra: "result=FAIL" });
      return { success: false, error: "You need to sign in as an admin.", code: "UNKNOWN", reference };
    }
    logProductAiEvent({ reference, step: "auth", extra: "result=PASS" });

    const id = String(productId ?? "").trim();
    if (!id) return fail("UNKNOWN", reference, "reason=missing_product_id");

    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, sku, is_active, category_id, product_images(image_url, position)")
      .eq("id", id)
      .maybeSingle();

    if (error || !product) {
      logProductAiEvent({ reference, step: "product_fetch", extra: "result=FAIL" });
      return fail("UNKNOWN", reference, "reason=product_missing");
    }
    logProductAiEvent({
      reference,
      step: "product_fetch",
      extra: `product=${shortProductId(product.id)} result=PASS`,
    });

    const { data: category } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("id", product.category_id)
      .maybeSingle();
    const categoryName = category?.name;
    const categorySlug = category?.slug;
    if (!categoryName || !categorySlug) return fail("UNKNOWN", reference, "reason=category_missing");

    const images = Array.isArray(product.product_images) ? [...product.product_images] : [];
    images.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    const imageUrl = images[0]?.image_url ?? "";
    const imagePath = imageUrl.startsWith("/images/") ? imageUrl.split("?")[0]?.slice(0, 80) : imageUrl.startsWith("https://") ? "https" : "other";
    logProductAiEvent({
      reference,
      step: "primary_image",
      extra: `path=${imagePath} trusted=${isTrustedProductImageUrl(imageUrl) ? "yes" : "no"}`,
    });
    if (!isTrustedProductImageUrl(imageUrl)) return fail("IMAGE_FETCH_FAILED", reference, "reason=untrusted_image");

    const imageHttpUrl = imageUrl.startsWith("/images/") ? publicImageHttpUrl(imageUrl) : imageUrl;
    logProductAiEvent({
      reference,
      step: "image_url",
      extra: `hasPublicUrl=${imageHttpUrl ? "yes" : "no"}`,
    });

    const image = await readTrustedProductImage(imageUrl);
    logProductAiEvent({
      reference,
      step: "image_fetch",
      extra: `status=${image.status} contentType=${image.contentType ?? "none"} bytes=${image.ok ? image.bytes.byteLength : image.bytes} source=${image.source} result=${image.ok ? "PASS" : "FAIL"}`,
    });
    if (!image.ok) return fail("IMAGE_FETCH_FAILED", reference, `status=${image.status}`);

    logProductAiEvent({
      reference,
      step: "gateway_init",
      extra: `model=google/gemini-2.5-flash bytes=${image.bytes.byteLength} transport=file-bytes`,
    });

    const suggestions = await analyzeProductImageWithGateway({
      bytes: image.bytes,
      mediaType: image.mediaType,
      categoryName,
      draftName: product.name ?? "",
    });
    logProductAiEvent({
      reference,
      step: "parse",
      extra: `hasName=${suggestions.name ? "yes" : "no"} hasDescription=${suggestions.description ? "yes" : "no"} result=PASS`,
    });

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

    logProductAiEvent({ reference, step: "return", extra: "result=PASS" });
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
    const code =
      error && typeof error === "object" && "name" in error && error.name === "ProductAiResponseInvalid"
        ? "AI_RESPONSE_INVALID"
        : classifyProductAiError(error);
    logProductAiEvent({
      reference,
      step: "model_response",
      code,
      extra: providerStatus(error),
    });
    return fail(code, reference, providerStatus(error));
  }
}
