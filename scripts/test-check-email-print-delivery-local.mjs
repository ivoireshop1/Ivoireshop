import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id.startsWith("./")) {
      const resolved = file.replace(/[^/\\]+$/, id.slice(2) + (id.endsWith(".ts") ? "" : ".ts"));
      return load(resolved.replace(/\\/g, "/").replace(".ts.ts", ".ts"));
    }
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require },
    { filename: file },
  );
  return exports;
}

const { maskEmail } = load("src/lib/auth/mask-email.ts");
const { remainingResendMs, resendCooldownLabel, isAuthRateLimited } = load("src/lib/auth/resend-cooldown.ts");
const { publicAuthActionMessage } = load("src/lib/auth/customer-auth-messages.ts");
const { isOrderPrintKind, money } = load("src/lib/print/kinds.ts");
const { isLowStock, LOW_STOCK_MAX_UNITS } = load("src/lib/catalog/low-stock.ts");
const { isShippingReady } = load("src/lib/delivery/package.ts");
const { fulfillmentDisplay } = load("src/lib/delivery/labels.ts");
let n = 0;
function test(name, fn) { fn(); n++; console.log("PASS " + name); }

test("email is masked", () => {
  assert.equal(maskEmail("jane@gmail.com").startsWith("j"), true);
  assert.equal(maskEmail("jane@gmail.com").includes("jane"), false);
  assert.equal(maskEmail("jane@gmail.com").endsWith("@gmail.com"), true);
});
test("resend cooldown is 60 seconds", () => {
  assert.equal(remainingResendMs(1000, 1000), 60000);
  assert.equal(remainingResendMs(1000, 61000), 0);
  assert.match(resendCooldownLabel(1500), /Resend available in 2 seconds/);
});
test("rate limit copy is branded", () => {
  assert.equal(isAuthRateLimited("Too many attempts"), true);
  assert.match(publicAuthActionMessage("Too many attempts"), /Give it a little time/);
  assert.equal(publicAuthActionMessage("Too many attempts").includes("Too many attempts"), false);
});
test("print kinds are allowlisted", () => {
  assert.equal(isOrderPrintKind("packing-slip"), true);
  assert.equal(isOrderPrintKind("evil"), false);
  assert.equal(money(12.5), "$12.50");
});
test("low stock uses the existing threshold", () => {
  assert.equal(LOW_STOCK_MAX_UNITS, 5);
  assert.equal(isLowStock(true, 5), true);
  assert.equal(isLowStock(true, 6), false);
  assert.equal(isLowStock(false, 1), false);
});
test("missing package data is not shipping ready", () => {
  assert.equal(isShippingReady({}), false);
  assert.equal(isShippingReady({ ship_weight_lb: 1, ship_length_in: 2, ship_width_in: 3, ship_height_in: 4 }), true);
});
test("fulfillment labels distinguish providers", () => {
  assert.equal(fulfillmentDisplay({ fulfillment_method: "local_pickup" }), "Pickup · Store Pickup");
  assert.match(fulfillmentDisplay({ fulfillment_method: "delivery", fulfillment_provider: "ups", fulfillment_service: "Ground" }), /UPS/);
});
test("client shipping amounts are not used as option ids", () => {
  assert.equal(isOrderPrintKind("0.95"), false);
});
console.log(`${n} check-email/print/delivery helper tests passed`);
