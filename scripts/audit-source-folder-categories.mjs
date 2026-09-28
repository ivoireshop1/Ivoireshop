// Deterministic source-folder category integrity audit.
// Reads the on-disk source folders and the live product rows, derives each
// product's expected category with the canonical mapper, and fails on a single
// cross-category assignment or unresolved source path.
//
// Usage: node scripts/audit-source-folder-categories.mjs [--json]
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// pg lives in the validation sandbox rather than the app dependencies.
async function loadPg() {
  const candidates = [
    process.env.PG_MODULE_PATH ? pathToFileURL(process.env.PG_MODULE_PATH).href : null,
    "pg",
    new URL("../.batch2-validation/node_modules/pg/lib/index.js", import.meta.url).href,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const loaded = await import(candidate);
      return loaded.default ?? loaded;
    } catch {
      continue;
    }
  }
  throw new Error("pg module not found; set PG_MODULE_PATH");
}
const pg = await loadPg();

function loadTs(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("@/")) return loadTs(id.slice(2) + ".ts");
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require, decodeURIComponent, URLSearchParams },
    { filename: file },
  );
  return exports;
}

const { canonicalCategoryFromSourceFolder } = loadTs("src/lib/catalog/source-folder-category.ts");
const { categoryNameFromId } = loadTs("src/lib/catalog/admin-product-list.ts");

export const EXPECTED_SOURCE_COUNTS = {
  Cosmetics: 100,
  Foods: 309,
  "Ivoire Market": 169,
};

const password = process.env.PGPASSWORD_B64
  ? Buffer.from(process.env.PGPASSWORD_B64, "base64").toString("utf8")
  : "";
const client = new pg.Client({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.lidqskyavlkzwerpncxa",
  password,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const categories = (await client.query("select id, name, slug from public.categories")).rows;
const rows = (await client.query(`
  select p.id, p.name, p.category_id, c.name as assigned_category, i.image_url
  from public.products p
  left join public.categories c on c.id = p.category_id
  left join lateral (
    select image_url from public.product_images
    where product_id = p.id
    order by position, created_at
    limit 1
  ) i on true
  order by p.created_at desc
`)).rows;

const counts = { Cosmetics: 0, Foods: 0, "Ivoire Market": 0 };
const mismatches = [];
const unresolved = [];
const badgeMismatches = [];

for (const row of rows) {
  const expected = canonicalCategoryFromSourceFolder(row.image_url ?? "");
  const badge = categoryNameFromId(row.category_id, categories);
  if (badge !== (row.assigned_category ?? "Uncategorized")) {
    badgeMismatches.push({ id: row.id, badge, assigned: row.assigned_category });
  }
  if (!expected) {
    unresolved.push({ id: row.id, imageUrl: row.image_url });
    continue;
  }
  counts[expected] += 1;
  if (row.assigned_category !== expected) {
    mismatches.push({
      id: row.id,
      name: row.name,
      imageUrl: decodeURIComponent(row.image_url ?? ""),
      expected,
      assigned: row.assigned_category ?? "Uncategorized",
    });
  }
}

const countsMatch = Object.entries(EXPECTED_SOURCE_COUNTS).every(([key, value]) => counts[key] === value);
const report = {
  totalChecked: rows.length,
  derivedFromSourceFolder: counts,
  expectedFromSourceFolder: EXPECTED_SOURCE_COUNTS,
  sourceCountsMatch: countsMatch,
  categoryMismatches: mismatches.length,
  unresolvedSourcePaths: unresolved.length,
  badgeLookupMismatches: badgeMismatches.length,
  mismatchSamples: mismatches.slice(0, 15),
  unresolvedSamples: unresolved.slice(0, 15),
};

console.log(JSON.stringify(report, null, 2));
await client.end();

const failed =
  mismatches.length > 0 ||
  unresolved.length > 0 ||
  badgeMismatches.length > 0 ||
  !countsMatch ||
  rows.length !== 578;
if (failed) {
  console.error("FAIL source-folder category integrity");
  process.exit(1);
}
console.log("PASS source-folder category integrity");
