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
});

test("prompt locks category and forbids price inventory and medical claims", () => {
  const prompt = productAiSystemPrompt("Cosmetics");
  assert.match(prompt, /Cosmetics/);
  assert.match(prompt, /Never change or suggest a different category/);
  assert.match(prompt, /selling price/);
  assert.match(prompt, /medical claims/);
});

test("AI action module does not write product rows", () => {
  const source = fs.readFileSync("src/lib/catalog/product-ai-actions.ts", "utf8");
  assert.doesNotMatch(source, /\.update\(/);
  assert.doesNotMatch(source, /\.insert\(/);
  assert.match(source, /fillProductDetailsWithAi/);
  assert.match(fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8"), /Fill with AI/);
});

test("AI keys are not exposed to the browser bundle of the form", () => {
  const form = fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8");
  assert.doesNotMatch(form, /AI_GATEWAY|OPENAI_API_KEY|ANTHROPIC_API_KEY/);
  assert.match(form, /fillProductDetailsWithAi/);
});

test("Fill with AI preserves category price quantity and status in the editor", () => {
  const form = fs.readFileSync("src/components/admin/catalog-form.tsx", "utf8");
  assert.match(form, /preserved\.categoryId/);
  assert.match(form, /setPrice\(preserved\.price\)/);
  assert.match(form, /setStockQuantity\(preserved\.stockQuantity\)/);
  assert.match(form, /setIsActive\(preserved\.isActive\)/);
  assert.doesNotMatch(form, /setCategoryId\(result/);
});

console.log(`${n} product AI tests passed.`);
