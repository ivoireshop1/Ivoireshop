import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
    if (id.startsWith("node:")) return nodeRequire(id);
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require, Buffer, URL, process },
    { filename: file },
  );
  return exports;
}

const { skuPrefixForCategorySlug, skuFromProductId, resolvePersistedSku } = load("src/lib/catalog/sku.ts");
const { isTrustedProductImageUrl } = load("src/lib/catalog/trusted-product-image.ts");
const { sanitizeProductAiSuggestion, parseProductAiJson, suggestionHasContent, productAiSystemPrompt } = load(
  "src/lib/catalog/product-ai.ts",
);
const { publicImageDiskPath } = load("src/lib/catalog/product-ai-image.ts");

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("category prefixes are deterministic", () => {
  assert.equal(skuPrefixForCategorySlug("foods"), "FOOD");
  assert.equal(skuPrefixForCategorySlug("cosmetics"), "COS");
  assert.equal(skuPrefixForCategorySlug("ivoire-market"), "IVM");
  assert.equal(skuPrefixForCategorySlug("snacks"), null);
});

test("SKU uses category prefix and product id", () => {
  const id = "af99b9a1-1234-4000-8000-000000000001";
  assert.equal(skuFromProductId("FOOD", id), "FOOD-AF99B");
  assert.equal(skuFromProductId("COS", id), "COS-AF99B");
  assert.equal(skuFromProductId("IVM", id), "IVM-AF99B");
});

test("existing SKU is never replaced", () => {
  const result = resolvePersistedSku({
    existingSku: "FOOD-KEEP1",
    submittedSku: "COS-NEW01",
    categorySlug: "foods",
    productId: "11111111-1111-4111-8111-111111111111",
    takenSkus: ["FOOD-KEEP1"],
  });
  assert.equal(result.sku, "FOOD-KEEP1");
  assert.equal(result.generated, false);
});

test("missing SKU is generated uniquely", () => {
  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const first = skuFromProductId("COS", id, []);
  const second = skuFromProductId("COS", id, [first]);
  assert.match(first, /^COS-[A-Z0-9]{5,}$/);
  assert.notEqual(second, first);
});

test("encoded stored image paths stay trusted and fetchable", () => {
  const { encodePublicImagePath } = load("src/lib/catalog/product-ai-image.ts");
  assert.equal(
    encodePublicImagePath("/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-(3).jpg"),
    "/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-(3).jpg",
  );
  assert.equal(
    encodePublicImagePath("/images/Foods 12-22-25/Ivoire Market Pictre2/My project-(3).jpg"),
    "/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-(3).jpg",
  );
});

test("only trusted stored images are allowed", () => {
  assert.equal(isTrustedProductImageUrl("/images/Foods%2012-22-25/Comestics%2012-22-25/soap.jpeg"), true);
  assert.equal(
    isTrustedProductImageUrl("https://lidqskyavlkzwerpncxa.supabase.co/storage/v1/object/public/product-images/a.jpg"),
    true,
  );
  assert.equal(isTrustedProductImageUrl("https://evil.example/x.jpg"), false);
  assert.equal(isTrustedProductImageUrl("/images/../secret.jpg"), false);
  assert.equal(isTrustedProductImageUrl("/images/%2e%2e/secret.jpg"), false);
  assert.equal(isTrustedProductImageUrl("https://images.unsplash.com/x.jpg"), false);
  assert.equal(publicImageDiskPath("/images/../etc/passwd"), null);
});

test("AI output is sanitized and does not invent medical claims", () => {
  const clean = sanitizeProductAiSuggestion({
    name: "Shea Body Lotion",
    shortDescription: "250 ml bottle",
    description: "A shea body lotion in a 250 ml bottle.",
    brand: "Shown Brand",
    price: "9.99",
    category: "Ivoire Market",
  });
  assert.equal(clean.name, "Shea Body Lotion");
  assert.equal(clean.brand, "Shown Brand");
  assert.equal("price" in clean, false);
  const unsafe = sanitizeProductAiSuggestion({
    name: "Miracle Cream",
    description: "This cream cures acne and is clinically proven.",
  });
  assert.equal(unsafe.description, null);
});

test("empty or broken AI JSON is treated as failure content", () => {
  assert.equal(suggestionHasContent(parseProductAiJson("not json")), false);
  assert.equal(suggestionHasContent(parseProductAiJson('{"name":"Palm Oil","description":"Red palm oil."}')), true);
  const fenced = parseProductAiJson('```json\n{"name":"Palm Oil","description":"Red palm oil."}\n```');
  assert.equal(fenced.name, "Palm Oil");
  const optionalMissing = parseProductAiJson('{"name":"Palm Oil","description":"Red palm oil."}');
  assert.equal(optionalMissing.shortDescription, null);
  assert.equal(suggestionHasContent(optionalMissing), true);
});

test("failure codes distinguish image fetch from AI auth and timeouts", () => {
  const { classifyProductAiError, productAiGatewayReady } = load("src/lib/catalog/product-ai-errors.ts");
  const timeout = new Error("aborted");
  timeout.name = "TimeoutError";
  assert.equal(classifyProductAiError(timeout), "AI_TIMEOUT");
  assert.equal(classifyProductAiError({ statusCode: 401 }), "AI_AUTH_FAILED");
  assert.equal(classifyProductAiError({ statusCode: 429 }), "AI_RATE_LIMITED");
  assert.equal(productAiGatewayReady(), Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1"));
});

test("prompt locks category and writes English copy without invented claims", () => {
  const prompt = productAiSystemPrompt("Cosmetics");
  assert.match(prompt, /Cosmetics/);
  assert.match(prompt, /Never change or suggest a different category/);
  assert.match(prompt, /selling price/);
  assert.match(prompt, /medical claims/);
  assert.match(prompt, /professional English/);
  assert.match(prompt, /Do not mix French and English/);
  assert.match(prompt, /skin-lightening/);
});

test("production vision model is a free-tier Gateway model", () => {
  const source = fs.readFileSync("src/lib/catalog/product-ai-vision.ts", "utf8");
  assert.match(source, /google\/gemini-2\.5-flash/);
  assert.match(source, /type: "file"/);
});

test("AI action module does not write product rows", () => {
  const source = fs.readFileSync("src/lib/catalog/product-ai-actions.ts", "utf8");
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.insert\(/);
  assert.match(source, /fillProductDetailsWithAi/);
  assert.match(source, /logProductAiEvent/);
  assert.match(fs.readFileSync("src/lib/catalog/product-ai-errors.ts", "utf8"), /\[AI_PRODUCT_ASSIST\]/);
  assert.match(fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8"), /Fill with AI/);
});

test("AI keys are not exposed to the browser bundle of the form", () => {
  const form = fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8");
  assert.doesNotMatch(form, /AI_GATEWAY|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  assert.match(form, /fillProductDetailsWithAi/);
  assert.match(form, /Reference: AI-NET/);
});

test("Fill with AI preserves category price quantity and status in the editor", () => {
  const form = fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8");
  assert.match(form, /preserved\.categoryId/);
  assert.match(form, /setPrice\(preserved\.price\)/);
  assert.match(form, /setStockQuantity\(preserved\.stockQuantity\)/);
  assert.match(form, /setIsActive\(preserved\.isActive\)/);
  assert.doesNotMatch(form, /setCategoryId\(result/);
  assert.match(form, /isImportedPlaceholderSlug/);
  assert.match(form, /!preserved\.isActive/);
});

console.log(`${n} product AI tests passed.`);
