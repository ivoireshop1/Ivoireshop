import assert from "node:assert/strict";
import fs from "node:fs";

let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

const page = fs.readFileSync("app/admin/orders/page.tsx", "utf8");
const item = fs.readFileSync("src/components/admin/admin-order-list-item.tsx", "utf8");

test("orders page still uses the existing query and filters", () => {
  assert.match(page, /from\("orders"\)/);
  assert.match(page, /order_number\.ilike/);
  assert.match(page, /payment_status/);
  assert.match(page, /fulfillment_method/);
  assert.doesNotMatch(page, /md:grid-cols-6/);
  assert.match(page, /@container/);
  assert.match(page, /@md:grid-cols-2/);
  assert.match(page, /@4xl:grid-cols-\[minmax\(16rem/);
  assert.doesNotMatch(page, /sm:grid-cols-2 lg:grid-cols-5/);
});

test("order cards follow container width instead of forcing six viewport columns", () => {
  assert.match(item, /@container|@xl:grid-cols-2/);
  assert.match(item, /@4xl:grid-cols-\[minmax\(12rem/);
  assert.match(item, /whitespace-nowrap/);
  assert.match(item, /overflow-wrap:anywhere/);
  assert.doesNotMatch(item, /md:grid-cols-6/);
  assert.doesNotMatch(item, /break-all/);
  assert.match(item, /whitespace-nowrap font-medium tabular-nums/);
  assert.match(item, /confirmation_code/);
});

test("query and status helpers are unchanged in the list item", () => {
  assert.match(item, /paymentStatusLabel\(order\.payment_status, order\.payment_provider\)/);
  assert.match(item, /orderStatusLabel\(order\.status, fulfillment\)/);
  assert.doesNotMatch(item, /createClient|from\("orders"\)/);
});

console.log(`${n} admin orders layout tests passed.`);
