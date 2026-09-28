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
  canonicalCategoryFromSourceFolder,
  publicImageUrlFromSourcePath,
  shouldCreateImportedDraft,
  draftSlugFromSource,
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
});

test("Cosmetics folder maps to Cosmetics even when misspelled", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Comestics 12-22-25"), "Cosmetics");
});

test("Ivoire Market folder maps to Ivoire Market including cookware filenames", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Ivoire Market Pictre2"), "Ivoire Market");
  assert.equal(canonicalCategoryFromSourceFolder("Ivoire Market Pictre2/pots-and-pans.jpg"), "Ivoire Market");
});

test("unknown folders are not guessed", () => {
  assert.equal(canonicalCategoryFromSourceFolder("Random Dump"), null);
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
