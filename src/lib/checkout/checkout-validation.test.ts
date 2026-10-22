import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCheckout } from "./checkout-validation.ts";
import {
  attachCheckoutWeightOption,
  checkoutItemsForSellingMethod,
  checkoutItemsFromCart,
  requireWeightOptionSchema,
  WEIGHT_OPTIONS_SCHEMA_REQUIRED,
  weightOptionCheckoutError,
} from "../catalog/weight-option-checkout.ts";
import { parseWeightOption } from "../catalog/weight-options.ts";

const productA = "11111111-1111-4111-8111-111111111111";
const productB = "22222222-2222-4222-8222-222222222222";
const option1 = "33333333-3333-4333-8333-333333333333";
const option2 = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "55555555-5555-4555-8555-555555555555";

function baseCheckout(items: unknown[]) {
  return {
    customerName: "Ada",
    customerEmail: "ada@example.com",
    customerPhone: "2025550100",
    address: { address_line_1: "1 Main", city: "Boston", country: "US" },
    fulfillmentMethod: "local_pickup",
    idempotencyKey,
    items,
  };
}

test("checkout keeps mixed-weight lines of the same product separate", () => {
  const validated = validateCheckout(baseCheckout([
    { product_id: productA, quantity: 1, weight_option_id: option1 },
    { product_id: productA, quantity: 2, weight_option_id: option2 },
    { product_id: productB, quantity: 1 },
  ]));
  assert.equal("request" in validated, true);
  if (!("request" in validated)) return;
  assert.equal(validated.request.items.length, 3);
  assert.deepEqual(
    validated.request.items.map((item) => [item.product_id, item.quantity, item.weight_option_id ?? ""]),
    [
      [productA, 1, option1],
      [productA, 2, option2],
      [productB, 1, ""],
    ],
  );
});

test("checkout rejects an invented weight option id", () => {
  const validated = validateCheckout(baseCheckout([
    { product_id: productA, quantity: 1, weight_option_id: "not-a-uuid" },
  ]));
  assert.equal(validated.error, "Your cart contains an invalid item or quantity. Please review it.");
});

test("weight-option checkout stays closed until the schema is applied", () => {
  assert.equal(
    requireWeightOptionSchema([{ product_id: productA, quantity: 1, weight_option_id: option1 }], false),
    WEIGHT_OPTIONS_SCHEMA_REQUIRED,
  );
  assert.equal(requireWeightOptionSchema([{ product_id: productA, quantity: 1 }], false), null);
});

test("disabled or missing weight options cannot check out", () => {
  const option = parseWeightOption({
    id: option1,
    product_id: productA,
    label: "2 lb",
    unit: "lb",
    net_weight: 2,
    price: 9,
    is_enabled: false,
  });
  assert.equal(
    weightOptionCheckoutError(
      [{ product_id: productA, quantity: 1, weight_option_id: option1 }],
      [{ id: productA, selling_method: "weight", weightOption: option }],
    ),
    "A selected weight option is no longer available.",
  );
});

test("each-sold products keep the saved product price and ignore weight_option_id", () => {
  const option = parseWeightOption({
    id: option1,
    product_id: productA,
    label: "2 lb",
    unit: "lb",
    net_weight: 2,
    price: 99,
    is_enabled: true,
  })!;
  const attached = attachCheckoutWeightOption(
    { id: productA, price: 12.5, selling_method: "each" },
    { product_id: productA, quantity: 2, weight_option_id: option1 },
    [option],
  );
  assert.equal(attached.price, 12.5);
  assert.equal(attached.weightOption, null);
  assert.deepEqual(
    checkoutItemsFromCart([{ productId: productA, quantity: 2, weightOptionId: option1, sellingMethod: "each" }]),
    [{ product_id: productA, quantity: 2 }],
  );
  const sanitized = checkoutItemsForSellingMethod(
    [{ product_id: productA, quantity: 2, weight_option_id: option1 }],
    [{ id: productA, selling_method: "each" }],
  );
  assert.deepEqual(sanitized, [{ product_id: productA, quantity: 2 }]);
  assert.equal(requireWeightOptionSchema(sanitized, false), null);
  assert.equal(
    weightOptionCheckoutError(sanitized, [{ id: productA, selling_method: "each", weightOption: option }]),
    null,
  );
});

test("by-weight products still attach the selected option price", () => {
  const option = parseWeightOption({
    id: option1,
    product_id: productA,
    label: "2 lb",
    unit: "lb",
    net_weight: 2,
    price: 9,
    is_enabled: true,
  })!;
  const attached = attachCheckoutWeightOption(
    { id: productA, price: 12.5, selling_method: "weight" },
    { product_id: productA, quantity: 1, weight_option_id: option1 },
    [option],
  );
  assert.equal(attached.price, 9);
  assert.equal(attached.weightOption?.id, option1);
  assert.deepEqual(
    checkoutItemsForSellingMethod(
      [{ product_id: productA, quantity: 1, weight_option_id: option1 }],
      [{ id: productA, selling_method: "weight" }],
    ),
    [{ product_id: productA, quantity: 1, weight_option_id: option1 }],
  );
});
