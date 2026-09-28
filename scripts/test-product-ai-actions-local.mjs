import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const FAILURE = "AI couldn't fill this product. You can enter the details manually or try again.";
const FOODS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COSMETICS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MARKET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TRUSTED = "/images/Foods%2012-22-25/Comestics%2012-22-25/soap.jpeg";

let role;
let visionError;
let visionCalls;
let writes;
let products;
let categories;

function createSupabase() {
  return {
    auth: {
      getUser: async () => ({ data: { user: role === "admin" ? { id: "admin-1" } : role === "customer" ? { id: "cust-1" } : null } }),
    },
    from(table) {
      let operation = "select";
      let eqKey;
      let eqValue;
      const query = {
        select() {
          return this;
        },
        eq(key, value) {
          eqKey = key;
          eqValue = value;
          return this;
        },
        not() {
          return this;
        },
        maybeSingle() {
          return this.then((result) => result, undefined).then((result) => {
            const rows = result.data;
            const data = Array.isArray(rows) ? rows[0] ?? null : rows;
            return { data, error: null };
          });
        },
        then(resolve, reject) {
          try {
            let data = null;
            if (operation !== "select") writes.push({ table, operation });
            if (table === "profiles") {
              data = role ? { role } : null;
            } else if (table === "categories") {
              data = categories.filter((row) => (eqKey === "id" ? row.id === eqValue : true));
            } else if (table === "products") {
              if (!eqKey) data = products.map((row) => ({ id: row.id, sku: row.sku }));
              else data = products.filter((row) => row[eqKey] === eqValue);
            }
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return query;
    },
  };
}

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const require = (id) => {
    if (id === "next/navigation") return { unstable_rethrow() {} };
    if (id === "@/src/lib/supabase/server") return { createClient: async () => createSupabase() };
    if (id === "@/src/lib/catalog/product-ai-image") {
      return {
        readTrustedProductImage: async (url) =>
          url.startsWith("/images/")
            ? {
                ok: true,
                bytes: new Uint8Array([1, 2, 3]),
                mediaType: "image/jpeg",
                status: 200,
                contentType: "image/jpeg",
                source: "disk",
              }
            : { ok: false, status: 0, contentType: null, bytes: 0, source: "rejected" },
        publicImageHttpUrl: (url) => (url.startsWith("/images/") ? `https://example.test${url}` : null),
      };
    }
    if (id === "@/src/lib/catalog/product-ai-vision") {
      return {
        analyzeProductImageWithGateway: async (input) => {
          visionCalls.push(input);
          if (visionError) throw visionError;
          return {
            name: `${input.categoryName} suggestion`,
            shortDescription: "Packaging visible on the product photo.",
            description: `A ${input.categoryName.toLowerCase()} product identifiable from the packaging photo.`,
            brand: null,
            packageSize: null,
            productType: null,
          };
        },
      };
    }
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require, Buffer, URL, console, Uint8Array, process },
    { filename: file },
  );
  cache.set(file, exports);
  return exports;
}

const { fillProductDetailsWithAi } = load("src/lib/catalog/product-ai-actions.ts");

function reset() {
  role = "admin";
  visionError = null;
  visionCalls = [];
  writes = [];
  categories = [
    { id: "cat-foods", name: "Foods", slug: "foods" },
    { id: "cat-cosmetics", name: "Cosmetics", slug: "cosmetics" },
    { id: "cat-market", name: "Ivoire Market", slug: "ivoire-market" },
  ];
  products = [
    {
      id: FOODS,
      name: "Palm Oil Draft",
      sku: null,
      is_active: false,
      category_id: "cat-foods",
      product_images: [{ image_url: TRUSTED, position: 0 }],
    },
    {
      id: COSMETICS,
      name: "Shea Lotion Draft",
      sku: "COS-KEEP1",
      is_active: false,
      category_id: "cat-cosmetics",
      product_images: [{ image_url: TRUSTED, position: 0 }],
    },
    {
      id: MARKET,
      name: "Market Basket Draft",
      sku: null,
      is_active: true,
      category_id: "cat-market",
      product_images: [{ image_url: TRUSTED, position: 0 }],
    },
  ];
}

let n = 0;
async function test(name, fn) {
  reset();
  await fn();
  n++;
  console.log("PASS " + name);
}

await test("non-admin cannot call Fill with AI", async () => {
  role = "customer";
  const result = await fillProductDetailsWithAi(FOODS);
  assert.equal(result.success, false);
  assert.equal(result.error, "You need to sign in as an admin.");
  assert.equal(visionCalls.length, 0);
  assert.equal(writes.length, 0);
});

await test("signed-out user cannot call Fill with AI", async () => {
  role = null;
  const result = await fillProductDetailsWithAi(FOODS);
  assert.equal(result.success, false);
  assert.equal(visionCalls.length, 0);
});

await test("untrusted image URLs are rejected before vision", async () => {
  products[0].product_images = [{ image_url: "https://evil.example/x.jpg", position: 0 }];
  const result = await fillProductDetailsWithAi(FOODS);
  assert.equal(result.success, false);
  assert.match(result.error, new RegExp("^" + FAILURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.error, /Reference: AI-[A-F0-9]{4}/);
  assert.equal(result.code, "IMAGE_FETCH_FAILED");
  assert.equal(visionCalls.length, 0);
});

await test("Foods image is analyzed with locked Foods category", async () => {
  const result = await fillProductDetailsWithAi(FOODS);
  assert.equal(result.success, true);
  assert.equal(result.categoryName, "Foods");
  assert.equal(result.suggestions.name, "Foods suggestion");
  assert.match(result.sku, /^FOOD-/);
  assert.equal(result.skuGenerated, true);
  assert.equal(result.replaceName, true);
  assert.equal(visionCalls[0].draftName, "Palm Oil Draft");
  assert.equal(writes.length, 0);
  assert.equal(products[0].category_id, "cat-foods");
  assert.equal(products[0].sku, null);
});

await test("Cosmetics image keeps Cosmetics and existing SKU", async () => {
  const result = await fillProductDetailsWithAi(COSMETICS);
  assert.equal(result.success, true);
  assert.equal(result.categoryName, "Cosmetics");
  assert.equal(result.sku, "COS-KEEP1");
  assert.equal(result.skuGenerated, false);
  assert.equal(products[1].category_id, "cat-cosmetics");
  assert.equal(products[1].sku, "COS-KEEP1");
  assert.equal(writes.length, 0);
});

await test("Ivoire Market image is analyzed without changing category or publishing", async () => {
  const result = await fillProductDetailsWithAi(MARKET);
  assert.equal(result.success, true);
  assert.equal(result.categoryName, "Ivoire Market");
  assert.match(result.sku, /^IVM-/);
  assert.equal(result.replaceName, false);
  assert.equal(products[2].is_active, true);
  assert.equal(products[2].category_id, "cat-market");
  assert.equal(writes.length, 0);
});

await test("vision failure stays in editor and does not write", async () => {
  visionError = new Error("gateway timeout");
  visionError.name = "TimeoutError";
  const result = await fillProductDetailsWithAi(FOODS);
  assert.equal(result.success, false);
  assert.match(result.error, new RegExp("^" + FAILURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(result.error, /Reference: AI-[A-F0-9]{4}/);
  assert.equal(result.code, "AI_TIMEOUT");
  assert.equal(products[0].name, "Palm Oil Draft");
  assert.equal(writes.length, 0);
});

console.log(`${n} product AI action tests passed.`);
