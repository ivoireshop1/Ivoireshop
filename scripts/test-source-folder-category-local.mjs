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
    { exports, require, decodeURIComponent },
    { filename: file },
  );
  return exports;
}

const {
  canonicalCategoryFromSourceFolder,
  publicImageUrlFromSourcePath,
  shouldCreateImportedDraft,
  draftSlugFromSource,
  shouldReconcileImportedCategory,
} = load("src/lib/catalog/source-folder-category.ts");

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("Foods folder maps to Foods", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Foods 12-22-25"), "Foods");
  assert.equal(canonicalCategoryFromSourceFolder("Foods 12-22-25/rice.jpeg"), "Foods");
  assert.equal(
    canonicalCategoryFromSourceFolder("/images/Foods%2012-22-25/Foods%2012-22-25/rice.jpeg"),
    "Foods",
  );
});

test("Cosmetics folder maps to Cosmetics even when misspelled", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Comestics 12-22-25"), "Cosmetics");
  assert.equal(
    canonicalCategoryFromSourceFolder("/images/Foods%2012-22-25/Comestics%2012-22-25/soap.jpeg"),
    "Cosmetics",
  );
});

test("parent Foods wrapper does not classify cosmetics or market as Foods", () => {
  assert.equal(
    canonicalCategoryFromSourceFolder("/images/Foods 12-22-25/Comestics 12-22-25/lipstick.jpg"),
    "Cosmetics",
  );
  assert.equal(
    canonicalCategoryFromSourceFolder("/images/Foods 12-22-25/Ivoire Market Pictre2/pots.jpg"),
    "Ivoire Market",
  );
  assert.equal(canonicalCategoryFromSourceFolder("/images/Foods 12-22-25/orphan.jpg"), null);
});

test("QEI import image is classified from Ivoire Market Pictre2 only", () => {
  assert.equal(
    canonicalCategoryFromSourceFolder("/images/Foods%2012-22-25/Ivoire%20Market%20Pictre2/My%20project-1%20(134).jpg"),
    "Ivoire Market",
  );
});

test("unknown folders are not guessed", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Random Dump"), null);
});

test("existing matching assignments are not silently reclassified", () => {
  assert.equal(
    shouldReconcileImportedCategory({ expectedFromSourceFolder: "Cosmetics", currentCategoryName: "Cosmetics" }),
    false,
  );
  assert.equal(
    shouldReconcileImportedCategory({ expectedFromSourceFolder: "Cosmetics", currentCategoryName: "Ivoire Market" }),
    true,
  );
  assert.equal(
    shouldReconcileImportedCategory({ expectedFromSourceFolder: null, currentCategoryName: "Foods" }),
    false,
  );
});

test("drafts are inactive-priced and skip duplicates", () => {
  const imageUrl = publicImageUrlFromSourcePath("Ivoire Market Pictre2/pots.jpg");
  const slug = draftSlugFromSource("pots.jpg", "abc123def4567890");
  assert.equal(imageUrl.includes("Ivoire%20Market"), true);
  assert.equal(
    shouldCreateImportedDraft({
      imageUrl,
      slug,
      existingImageUrls: [imageUrl],
      existingSlugs: [],
    }),
    false,
  );
  assert.equal(
    shouldCreateImportedDraft({
      imageUrl,
      slug,
      existingImageUrls: [],
      existingSlugs: [slug],
    }),
    false,
  );
  assert.equal(
    shouldCreateImportedDraft({
      imageUrl,
      slug,
      existingImageUrls: [],
      existingSlugs: [],
    }),
    true,
  );
});

test("admin products list looks up category by id, not a nested array", () => {
  const source = fs.readFileSync("app/admin/products/page.tsx", "utf8");
  assert.match(source, /categoryNameFromId/);
  assert.doesNotMatch(source, /nestedCategories\[0\]/);
  assert.doesNotMatch(source, /categories\(name\)/);
  assert.match(source, /ADMIN_CATEGORY_TABS/);
  const manager = fs.readFileSync("src/components/admin/admin-products-manager.tsx", "utf8");
  assert.doesNotMatch(manager, /useState<.*>\("ivoire-market"\)/);
  assert.match(manager, /Choose category/);
  const generator = fs.readFileSync("scripts/generate-source-folder-drafts.mjs", "utf8");
  assert.match(generator, /source-folder-category\.ts/);
  assert.doesNotMatch(generator, /item\.classification/);
});

const sql = fs.readFileSync("supabase/migrations/20260928071000_source_folder_category_drafts.sql", "utf8");
test("generated import stays draft without invented price", () => {
  assert.match(sql, /slug = 'ivoire-market'/);
  assert.match(sql, /is_active,/);
  assert.match(sql, /track_inventory,/);
  assert.match(sql, /null,\s+null,\s+categories\.id/);
  assert.match(sql, /not exists \(\s*select 1 from public\.product_images/);
  assert.equal(/,\s*999/.test(sql), false);
});

console.log(`${n} source-folder category tests passed.`);
