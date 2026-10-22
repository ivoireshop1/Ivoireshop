import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cartLineKey,
  enabledWeightOptions,
  netWeightToLb,
  packagedLineWeightLb,
  parseWeightOption,
  storefrontWeightChoices,
  weightOptionLabel,
} from "./weight-options.ts";

const twoLb = parseWeightOption({
  id: "opt-2",
  product_id: "prod-1",
  label: "2 lb bag",
  unit: "lb",
  net_weight: 2,
  price: 8,
  stock_quantity: 4,
  is_enabled: true,
  sort_order: 2,
})!;
const fiveLb = parseWeightOption({
  id: "opt-5",
  product_id: "prod-1",
  label: "5 lb",
  unit: "lb",
  net_weight: 5,
  packaged_weight_lb: 5.4,
  price: 18,
  is_enabled: true,
  sort_order: 3,
})!;
const hidden = parseWeightOption({
  id: "opt-1",
  product_id: "prod-1",
  label: "1 lb",
  unit: "lb",
  net_weight: 1,
  price: 5,
  is_enabled: false,
})!;

test("weight options keep founder net weight, packaged weight, and price", () => {
  assert.equal(twoLb.netWeightLb, 2);
  assert.equal(twoLb.packagedWeightLb, null);
  assert.equal(fiveLb.packagedWeightLb, 5.4);
  assert.equal(fiveLb.price, 18);
  assert.equal(netWeightToLb(1, "kg"), 2.205);
});

test("disabled options stay hidden and do not corrupt cart identity", () => {
  const visible = enabledWeightOptions([hidden, fiveLb, twoLb]);
  assert.deepEqual(visible.map((option) => option.id), ["opt-2", "opt-5"]);
  assert.equal(cartLineKey("prod-1", twoLb.id), "prod-1::opt-2");
  assert.equal(cartLineKey("prod-1"), "prod-1");
  assert.equal(weightOptionLabel(twoLb), "2 lb bag");
});

test("mixed-weight cart lines use packaged weight times quantity", () => {
  assert.equal(packagedLineWeightLb(twoLb, 3, 0.2), 6.6);
  assert.equal(packagedLineWeightLb(fiveLb, 2, 0.2), 10.8);
  assert.equal(packagedLineWeightLb(twoLb, 0, 0.2), null);
});

test("storefront weight choices stay hidden unless the product is sold by weight", () => {
  assert.deepEqual(storefrontWeightChoices("each", [twoLb, fiveLb]), []);
  assert.deepEqual(storefrontWeightChoices("fixed_package", [twoLb]), []);
  assert.deepEqual(storefrontWeightChoices(null, [twoLb]), []);
  assert.deepEqual(storefrontWeightChoices("weight", [hidden, twoLb, fiveLb]).map((option) => option.id), ["opt-2", "opt-5"]);
});
