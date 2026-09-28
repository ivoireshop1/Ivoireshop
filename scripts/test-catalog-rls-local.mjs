import assert from "node:assert/strict";
import fs from "node:fs";

function productsPolicy(sql) {
  const match = sql.match(/create policy "Active products are public"[\s\S]*?;/i);
  assert.ok(match, "products public policy present");
  return match[0];
}

const merch = fs.readFileSync(new URL("../supabase/migrations/20260928030000_merchandising.sql", import.meta.url), "utf8");
const fix = fs.readFileSync(new URL("../supabase/migrations/20260928031000_fix_merchandising_rls.sql", import.meta.url), "utf8");

const brokenProductsPolicy = `
create policy "Active products are public"
on public.products for select to anon, authenticated
using (
  is_coming_soon
  and exists (
    select 1 from public.product_images
    where product_images.product_id = products.id
  )
);
`;

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("the recursive Coming Soon products policy inspects product_images", () => {
  assert.equal(/product_images/i.test(productsPolicy(brokenProductsPolicy)), true);
});

test("checked-in merchandising products policy does not query product_images", () => {
  assert.equal(/product_images/i.test(productsPolicy(merch)), false);
  assert.equal(/product_images/i.test(productsPolicy(fix)), false);
});

test("image policy may still inspect products without the reverse cycle", () => {
  assert.equal(/from public\.products/i.test(fix), true);
  assert.equal(/product_images\.product_id = products\.id/i.test(productsPolicy(fix)), false);
});

test("the optional inventory migration does not rewrite merchandising RLS", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260928054603_optional_inventory_bulk_categories.sql", import.meta.url), "utf8");
  assert.equal(/create policy "Active products are public"/i.test(sql), false);
  assert.equal(/drop policy "Active products are public"/i.test(sql), false);
});

console.log(`${n} catalog RLS regression tests passed`);
