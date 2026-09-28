import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/checkout/view-order-href.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports },
  { filename: "src/lib/checkout/view-order-href.ts" },
);
const { viewOrderHref } = exports;

const id = "20000000-0000-4000-8000-000000000001";
const token = "a".repeat(64);
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("signed-in owner View Order uses the account order UUID", () => {
  assert.equal(viewOrderHref({ orderId: id, guestAccessToken: token, accountOrder: true }), `/account/orders/${id}`);
});

test("guest View Order uses the 64-character access token route", () => {
  assert.equal(viewOrderHref({ orderId: id, guestAccessToken: token, accountOrder: false }), `/order/confirm/${token}`);
});

test("IVO codes and guessed numeric IDs are not treated as authorization", () => {
  assert.equal(viewOrderHref({ orderId: "IVO-Q7HMK", guestAccessToken: "IVO-Q7HMK", accountOrder: true }), null);
  assert.equal(viewOrderHref({ orderId: "123", guestAccessToken: "123", accountOrder: false }), null);
  assert.equal(viewOrderHref({ orderId: id, guestAccessToken: token.slice(0, 32), accountOrder: false }), null);
});

test("later sign-in cannot turn a guest order into an account URL", () => {
  assert.equal(viewOrderHref({ orderId: id, guestAccessToken: token, accountOrder: false }), `/order/confirm/${token}`);
});

const checkout = fs.readFileSync("src/components/cart/checkout-page.tsx", "utf8");
const confirm = fs.readFileSync("src/components/checkout/order-confirmation-experience.tsx", "utf8");
const guest = fs.readFileSync("app/order/confirm/[token]/page.tsx", "utf8");
const detail = fs.readFileSync("app/account/orders/[id]/page.tsx", "utf8");

test("checkout confirmation no longer falls back to /account or a guest-only View Order", () => {
  assert.match(checkout, /viewOrderHref\(/);
  assert.doesNotMatch(checkout, /viewHref=\{token \? `\/order\/confirm\/\$\{token\}` : "\/account"\}/);
  assert.match(confirm, /viewHref \?/);
  assert.match(guest, /accountOrder,/);
  assert.match(detail, /markOrderNotificationsSeen/);
  assert.doesNotMatch(detail, /markNotificationOrderRead/);
});

console.log(`${n} view-order href tests passed.`);
