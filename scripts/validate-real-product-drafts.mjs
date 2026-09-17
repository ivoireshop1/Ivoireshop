import { access, readFile } from "node:fs/promises";
import path from "node:path";

const migrationPath = path.resolve("supabase/migrations/20260912060000_create_real_product_drafts.sql");
const publicPath = path.resolve("public");
const sql = await readFile(migrationPath, "utf8");
const tuples = [...sql.matchAll(/^  \('((?:''|[^'])*)', '([^']+)', '((?:''|[^'])*)', '([^']+)'\),?$/gm)].map(
  ([, name, slug, category, imagePath]) => ({
    name: name.replaceAll("''", "'"),
    slug,
    category: category.replaceAll("''", "'"),
    imagePath,
  }),
);

const duplicateValues = (values) =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const decodePublicPath = (imagePath) =>
  path.join(publicPath, ...imagePath.replace(/^\/images\//, "").split("/").map(decodeURIComponent));
const brokenImagePaths = [];

for (const product of tuples) {
  try {
    await access(decodePublicPath(product.imagePath));
  } catch {
    brokenImagePaths.push(product.imagePath);
  }
}

const report = {
  product_drafts: tuples.length,
  image_matches: tuples.length - brokenImagePaths.length,
  duplicate_names: duplicateValues(tuples.map((product) => product.name.toLocaleLowerCase("en-US"))),
  duplicate_slugs: duplicateValues(tuples.map((product) => product.slug.toLocaleLowerCase("en-US"))),
  broken_image_paths: brokenImagePaths,
  draft_fields_present:
    /alter column description drop not null/.test(sql) &&
    /select source\.name, source\.slug, null, null, null, categories\.id, null, false, false, true/.test(sql) &&
    /set name = excluded\.name,[\s\S]*price = null,[\s\S]*stock_quantity = null,[\s\S]*is_active = false,[\s\S]*needs_pricing = true/.test(sql),
};

console.log(JSON.stringify(report, null, 2));

if (
  report.product_drafts !== 409 ||
  report.duplicate_names.length > 0 ||
  report.duplicate_slugs.length > 0 ||
  report.broken_image_paths.length > 0 ||
  !report.draft_fields_present
) {
  process.exitCode = 1;
}