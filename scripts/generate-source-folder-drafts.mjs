import { readFile, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

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
    { exports, require, decodeURIComponent },
    { filename: file },
  );
  return exports;
}

const {
  canonicalCategoryFromSourceFolder,
  publicImageUrlFromSourcePath,
  draftSlugFromSource,
  draftNameFromSource,
} = loadTs("src/lib/catalog/source-folder-category.ts");

const inventoryPath = path.resolve("public/images/Foods 12-22-25/image-inventory.json");
const outputPath = path.resolve("supabase/migrations/20260928071000_source_folder_category_drafts.sql");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const inventory = JSON.parse((await readFile(inventoryPath, "utf8")).replace(/^\uFEFF/, ""));
const ivoireMarket = inventory.filter((item) => canonicalCategoryFromSourceFolder(item.path) === "Ivoire Market");

const values = ivoireMarket.map((item) => {
  const imageUrl = publicImageUrlFromSourcePath(item.path);
  const slug = draftSlugFromSource(item.filename || path.basename(item.path), item.sha256);
  const name = draftNameFromSource(item.filename || path.basename(item.path));
  return `    (${sqlString(name)}, ${sqlString(slug)}, ${sqlString(imageUrl)})`;
});

const sql = `-- Source-folder category integrity.
-- Foods / Cosmetics / Ivoire Market are assigned from the image folder, not guessed from the product name.
-- Existing products are remapped by image URL. Missing Ivoire Market images become drafts.
-- Does not invent price or quantity, does not activate products, does not overwrite approved live prices.

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'cosmetics'
where i.product_id = p.id
  and (
    i.image_url ilike '%Comestics%'
    or i.image_url ilike '%/Cosmetics%'
    or i.image_url ilike '%Cosmetics%2012-22-25%'
  );

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'ivoire-market'
where i.product_id = p.id
  and i.image_url ilike '%Ivoire%Market%';

update public.products p
set
  category_id = c.id,
  needs_category_review = false
from public.product_images i
join public.categories c on c.slug = 'foods'
where i.product_id = p.id
  and i.image_url ilike '%Foods%2012-22-25%'
  and i.image_url not ilike '%Comestics%'
  and i.image_url not ilike '%/Cosmetics%'
  and i.image_url not ilike '%Ivoire%Market%';

with source_products (name, slug, image_url) as (
  values
${values.join(",\n")}
),
inserted as (
  insert into public.products (
    name,
    slug,
    description,
    price,
    stock_quantity,
    category_id,
    sku,
    is_active,
    is_featured,
    needs_pricing,
    track_inventory,
    needs_category_review
  )
  select
    source_products.name,
    source_products.slug,
    null,
    null,
    null,
    categories.id,
    null,
    false,
    false,
    true,
    false,
    false
  from source_products
  join public.categories on categories.slug = 'ivoire-market'
  where not exists (
    select 1 from public.product_images where product_images.image_url = source_products.image_url
  )
  and not exists (
    select 1 from public.products where products.slug = source_products.slug
  )
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.product_images (product_id, image_url, alt_text, position)
select inserted.id, source_products.image_url, source_products.name, 0
from inserted
join source_products on source_products.slug = inserted.slug
where not exists (
  select 1 from public.product_images where product_images.product_id = inserted.id
);
`;

await writeFile(outputPath, sql);
console.log(`Wrote ${ivoireMarket.length} Ivoire Market draft rows to ${path.basename(outputPath)}`);
