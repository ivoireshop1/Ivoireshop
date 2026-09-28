import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("@/")) return load(id.slice(2) + ".ts");
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require },
    { filename: file },
  );
  return exports;
}

const {
  slugifyProductName,
  isImportedPlaceholderSlug,
  uniqueProductSlug,
  adminProductViewHref,
  adminProductViewLabel,
} = load("src/lib/catalog/product-slug.ts");

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("draft View goes to admin Preview and active View goes to the storefront URL", () => {
  const draft = { id: "draft-1", slug: "src-7ec472cdd6a4-my-project-1-134", isActive: false };
  const active = { id: "live-1", slug: "nina-nchanwu-nunum-leaves-28-5g", isActive: true };
  assert.equal(adminProductViewLabel(false), "Preview");
  assert.equal(adminProductViewHref(draft), "/admin/products/draft-1/preview");
  assert.equal(adminProductViewLabel(true), "View Storefront");
  assert.equal(adminProductViewHref(active), "/product/nina-nchanwu-nunum-leaves-28-5g");
});

test("import placeholder slugs can be replaced from an approved draft name", () => {
  assert.equal(isImportedPlaceholderSlug("src-7ec472cdd6a4-my-project-1-134"), true);
  assert.equal(isImportedPlaceholderSlug("qei-privilege-caviar-pearl-toning-body-milk"), false);
  assert.equal(
    slugifyProductName("QEI+ Privilège Caviar Pearl Toning Body Milk"),
    "qei-privilege-caviar-pearl-toning-body-milk",
  );
  assert.equal(uniqueProductSlug("qei-privilege-caviar-pearl-toning-body-milk", ["qei-privilege-caviar-pearl-toning-body-milk"]), "qei-privilege-caviar-pearl-toning-body-milk-2");
});

test("preview is admin-only and does not add unpublished products to the cart", () => {
  const preview = fs.readFileSync("app/admin/products/[id]/preview/page.tsx", "utf8");
  const detail = fs.readFileSync("src/components/product/product-storefront-detail.tsx", "utf8");
  const productPage = fs.readFileSync("app/product/[slug]/page.tsx", "utf8");
  const catalog = fs.readFileSync("src/lib/catalog/catalog.ts", "utf8");
  const sitemap = fs.readFileSync("app/sitemap.ts", "utf8");
  const row = fs.readFileSync("src/components/admin/admin-product-row.tsx", "utf8");
  assert.match(preview, /requireAdmin/);
  assert.match(preview, /mode="preview"/);
  assert.match(detail, /Unpublished drafts cannot be added to the cart/);
  assert.match(detail, /mode === "preview"/);
  assert.match(productPage, /if \(!productRow\.is_active && !isComingSoon\) notFound/);
  assert.match(catalog, /\.eq\("is_active", true\)/);
  assert.match(sitemap, /getProducts/);
  assert.match(row, /adminProductViewHref/);
  assert.doesNotMatch(preview, /AddToCart/);
});

test("missing admin products redirect to the catalog instead of a generic 404", () => {
  const edit = fs.readFileSync("app/admin/products/[id]/page.tsx", "utf8");
  const preview = fs.readFileSync("app/admin/products/[id]/preview/page.tsx", "utf8");
  const list = fs.readFileSync("app/admin/products/page.tsx", "utf8");
  assert.match(edit, /product_missing/);
  assert.match(preview, /product_missing/);
  assert.match(list, /no longer in the catalog/);
});

console.log(`${n} admin preview tests passed.`);
