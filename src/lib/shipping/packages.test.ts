import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describePackedParcels,
  parcelFailureMessage,
  parseShippingPackage,
  pickSuitablePackage,
  resolveCartParcel,
  resolveLineParcel,
} from "./packages.ts";
import { parseWeightOption } from "../catalog/weight-options.ts";
import { destinationReadyForCarrierQuotes } from "../delivery/destination.ts";
import { shippoShipmentParcels } from "./shippo.ts";
import { STEEL_SIX_CART } from "./steel-six-cart.ts";

const small = parseShippingPackage({
  id: "pkg-small",
  name: "Small grocery box",
  length_in: 10,
  width_in: 8,
  height_in: 6,
  max_weight_lb: 5,
  tare_weight_lb: 0.3,
  is_active: true,
})!;
const medium = parseShippingPackage({
  id: "pkg-medium",
  name: "Medium grocery box",
  length_in: 14,
  width_in: 10,
  height_in: 8,
  max_weight_lb: 20,
  tare_weight_lb: 0.5,
  is_active: true,
})!;

test("single-item package uses founder box and verified item weight", () => {
  const line = resolveLineParcel({
    product: { quantity: 1, item_weight_lb: 2, shipping_package_id: "pkg-small" },
    packages: [small, medium],
  });
  assert.equal("parcel" in line, true);
  if ("parcel" in line) {
    assert.equal(line.parcel.weightLb, 2.3);
    assert.equal(line.parcel.lengthIn, 10);
    assert.equal(line.parcel.widthIn, 8);
    assert.equal(line.parcel.heightIn, 6);
  }
});

test("multiple quantities add verified weight and keep the assigned box", () => {
  const line = resolveLineParcel({
    product: { quantity: 3, item_weight_lb: 1.5, shipping_package_id: "pkg-medium" },
    packages: [small, medium],
  });
  assert.equal("parcel" in line, true);
  if ("parcel" in line) assert.equal(line.parcel.weightLb, 5);
});

test("mixed cart keeps measured boxes and never stacks product heights", () => {
  const cart = resolveCartParcel({
    products: [
      { quantity: 1, ship_weight_lb: 2, ship_length_in: 9, ship_width_in: 7, ship_height_in: 5, name: "Rice" },
      { quantity: 2, item_weight_lb: 1, shipping_package_id: "pkg-medium", name: "Fufu" },
    ],
    packages: [small, medium],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcels.length, 2);
  assert.equal(cart.parcels[0].heightIn, 5);
  assert.equal(cart.parcels[1].heightIn, 8);
  assert.equal(cart.parcels.some((parcel) => parcel.heightIn === 13), false);
  assert.equal(Number(cart.totalWeightLb?.toFixed(1)), 4.5);
});

test("oversized item is rejected instead of inventing a larger box", () => {
  const line = resolveLineParcel({
    product: {
      quantity: 1,
      item_weight_lb: 1,
      ship_length_in: 20,
      ship_width_in: 12,
      ship_height_in: 10,
      shipping_package_id: "pkg-small",
    },
    packages: [small],
  });
  assert.equal("code" in line && line.code, "oversized");
});

test("missing weight and disabled estimate presets stay explicit and do not call a carrier", () => {
  const missingWeight = resolveLineParcel({
    product: { quantity: 1, shipping_package_id: "pkg-small" },
    packages: [small],
  });
  const missingBox = resolveLineParcel({
    product: { quantity: 1, item_weight_lb: 2 },
    packages: [],
    useEstimatedPresets: false,
  });
  assert.equal("code" in missingWeight && missingWeight.code, "missing_weight");
  assert.equal("code" in missingBox && missingBox.code, "missing_box");
  assert.match(parcelFailureMessage("missing_weight"), /not an Easyship authentication error/);
  assert.match(parcelFailureMessage("missing_box"), /not an Easyship authentication error/);
});

test("estimated presets pack a verified item when no measured box is assigned", () => {
  const line = resolveLineParcel({
    product: { quantity: 1, item_weight_lb: 2, weight_source: "verified" },
    packages: [],
  });
  assert.equal("parcel" in line, true);
  if ("parcel" in line) {
    assert.equal(line.parcel.estimatedBox, true);
    assert.equal(line.parcel.boxId, "estimate-small-box");
    assert.equal(line.parcel.weightLb, 2.2);
    assert.equal(line.parcel.lengthIn, 12);
  }
});

test("package capacity exceeded is rejected", () => {
  const line = resolveLineParcel({
    product: { quantity: 4, item_weight_lb: 2, shipping_package_id: "pkg-small" },
    packages: [small],
  });
  assert.equal("code" in line && line.code, "capacity_exceeded");
});

test("over-capacity mixed grocery splits into another measured box instead of inventing height", () => {
  const cart = resolveCartParcel({
    products: [
      { quantity: 3, item_weight_lb: 2, shipping_package_id: "pkg-small", name: "Corned beef" },
    ],
    packages: [small],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcels.length, 2);
  assert.ok(cart.parcels.every((parcel) => parcel.lengthIn === 10 && parcel.heightIn === 6));
});

const steelSix = STEEL_SIX_CART;

test("six Steel screenshot products pack with labeled estimates and never invent a carrier price", () => {
  const cart = resolveCartParcel({
    products: steelSix.map((product) => ({ ...product })),
    packages: [],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.usedEstimatedWeight, true);
  assert.equal(cart.usedEstimatedBox, true);
  assert.ok((cart.parcels?.length ?? 0) >= 2);
  const described = describePackedParcels(cart.parcels);
  assert.ok(described.every((parcel) => parcel.estimatedBox));
  assert.ok(described.some((parcel) => parcel.boxId === "estimate-large-box" && parcel.weightLb === 29.7));
  assert.ok(described.every((parcel) => parcel.unknownItemDimensions));
  assert.ok(cart.reviews.some((row) => row.source === "category_estimate"));
  assert.ok(cart.reviews.some((row) => row.source === "estimated_box"));
  assert.ok(cart.reviews.some((row) => /unknown item dimensions/i.test(row.reason)));
  const riceParcel = cart.parcels.find((parcel) => parcel.items.some((item) => /ELEPHANT BRAND/i.test(item.description)));
  assert.ok(riceParcel);
  assert.ok((riceParcel?.weightLb ?? 0) <= 30);
  assert.equal(destinationReadyForCarrierQuotes({
    address_line_1: "1 Main St",
    city: "Clayton",
    state: "OH",
    postal_code: "45315",
    country: "US",
  }), true);
  assert.equal(destinationReadyForCarrierQuotes({
    address_line_1: "100 Queen St W",
    city: "Toronto",
    state: "ON",
    postal_code: "M5V 2T6",
    country: "CA",
  }), true);
});

test("Steel grocery default packs all six products and quantities into two parcels", () => {
  const grocery = parseShippingPackage({
    id: "af66826c-c9ad-464d-a001-a0f79387f949",
    name: "standard grocery box",
    length_in: 16,
    width_in: 12,
    height_in: 8,
    max_weight_lb: 30,
    tare_weight_lb: 0.39,
    is_active: true,
  })!;
  const cart = resolveCartParcel({
    products: steelSix.map((product) => ({ ...product })),
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcels.length, 2);
  const weights = cart.parcels.map((parcel) => parcel.weightLb).sort((a, b) => b - a);
  assert.equal(weights[0], 29.49);
  assert.equal(weights[1], 6.165);
  const descriptions = cart.parcels.flatMap((parcel) => parcel.items.map((item) => item.description));
  const quantities = cart.parcels.flatMap((parcel) => parcel.items.map((item) => item.quantity));
  assert.equal(descriptions.length, 6);
  assert.equal(quantities.reduce((sum, qty) => sum + qty, 0), 6);
  for (const line of steelSix) {
    assert.ok(descriptions.includes(line.name), `missing ${line.name}`);
  }
  assert.equal(JSON.stringify(describePackedParcels(cart.parcels)).includes("amount"), false);
});

test("six Steel products become a Shippo multi-parcel payload without inventing a carrier price", () => {
  const grocery = parseShippingPackage({
    id: "af66826c-c9ad-464d-a001-a0f79387f949",
    name: "standard grocery box",
    length_in: 16,
    width_in: 12,
    height_in: 8,
    max_weight_lb: 30,
    tare_weight_lb: 0.39,
    is_active: true,
  })!;
  const cart = resolveCartParcel({
    products: steelSix.map((product) => ({ ...product })),
    packages: [grocery],
    defaultPackageId: grocery.id,
  });
  assert.equal(cart.missing, 0);
  assert.ok((cart.parcels?.length ?? 0) >= 1);
  const payload = shippoShipmentParcels({ parcels: cart.parcels });
  assert.equal(payload.length, cart.parcels.length);
  assert.ok(payload.every((parcel) => Number(parcel.weight) > 0 && Number(parcel.length) > 0));
  assert.equal(JSON.stringify(payload).includes("amount"), false);
});

test("six Steel products stay closed when estimated presets are disabled and no measured box exists", () => {
  const cart = resolveCartParcel({
    products: steelSix.map((product) => ({ ...product })),
    packages: [],
    useEstimatedPresets: false,
  });
  assert.ok(cart.missing > 0);
  assert.equal(cart.parcels.length, 0);
  assert.equal(cart.code, "missing_box");
});

test("a 50 lb product does not fit a 50 lb estimated box after packaging and the 10% allowance", () => {
  const cart = resolveCartParcel({
    products: [{
      quantity: 1,
      name: "50 lb rice bag",
      item_weight_lb: 50,
      packaging_weight_oz: 4,
      weight_source: "verified",
    }],
    packages: [],
  });
  assert.ok(cart.missing > 0);
  assert.equal(cart.code, "capacity_exceeded");
  assert.equal(cart.parcels.length, 0);
});

test("known item dimensions reject estimated boxes that are too small even when weight fits", () => {
  const cart = resolveCartParcel({
    products: [{
      quantity: 1,
      name: "Wide jar",
      item_weight_lb: 1,
      weight_source: "verified",
      dims: { length_in: 18, width_in: 14, height_in: 8 },
    }],
    packages: [],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcels[0]?.boxId, "estimate-large-box");
  assert.equal(cart.parcels[0]?.lengthIn, 20);
  assert.equal(cart.parcels[0]?.weightLb, 1.1);
  assert.equal(cart.parcels[0]?.unknownItemDimensions, false);
});

test("by-weight produce uses selected pounds plus configured packaging allowance", () => {
  const option = parseWeightOption({
    id: "opt-3lb",
    product_id: "yam-1",
    label: "3 lb",
    unit: "lb",
    net_weight: 3,
    net_weight_lb: 3,
    price: 6,
    is_enabled: true,
  });
  const cart = resolveCartParcel({
    products: [{
      quantity: 1,
      selling_method: "weight",
      packaging_weight_oz: 8,
      weightOption: option,
      shipping_package_id: "pkg-medium",
      name: "Yams",
    }],
    packages: [small, medium],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcels[0]?.weightLb, 4);
});

test("Easyship quote construction uses resolved parcel, not invented rates", () => {
  const option = parseWeightOption({
    id: "opt-2lb",
    product_id: "prod-1",
    label: "2 lb",
    unit: "lb",
    net_weight: 2,
    net_weight_lb: 2,
    packaged_weight_lb: 2.4,
    price: 9.5,
    is_enabled: true,
  });
  const cart = resolveCartParcel({
    products: [{ quantity: 1, weightOption: option, shipping_package_id: "pkg-small" }],
    packages: [small],
  });
  assert.equal(cart.missing, 0);
  assert.equal(cart.parcel?.weightLb, 2.7);
  assert.equal(cart.parcel?.lengthIn, 10);
});

test("pickup is unaffected when parcel data is invalid", () => {
  const cart = resolveCartParcel({
    products: [{ quantity: 1 }],
    packages: [],
  });
  assert.equal(cart.parcel, null);
  assert.equal(cart.code, "missing_weight");
});

test("AI estimated weights can quote with a 10% buffer and saved dimensions", () => {
  const line = resolveLineParcel({
    product: {
      quantity: 1,
      weight_oz: 160,
      packaging_weight_oz: 16,
      weight_source: "ai_estimate",
      dims: { length_in: 12, width_in: 8, height_in: 6 },
    },
    packages: [],
  });
  assert.equal("parcel" in line, true);
  if ("parcel" in line) {
    assert.equal(line.parcel.weightLb, 12.1);
    assert.equal(line.parcel.lengthIn, 12);
  }
});

test("pickSuitablePackage chooses the smallest approved box that fits", () => {
  const picked = pickSuitablePackage({ packedWeightLb: 4, packages: [medium, small] });
  assert.equal("package" in picked && picked.package.id, "pkg-small");
});
