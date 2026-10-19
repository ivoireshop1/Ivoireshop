import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSellQuantity,
  lineShipWeightLb,
  lineSubtotal,
  sellingSettingsFromProduct,
  snapQuantity,
} from "./selling.ts";

describe("selling helpers", () => {
  const plantains = sellingSettingsFromProduct({
    selling_method: "weight",
    selling_unit: "lb",
    unit_increment: 0.5,
    min_sell_qty: 0.5,
    max_sell_qty: 100,
    package_weight_lb: 0.1,
  });

  it("snaps weight to admin increments", () => {
    assert.equal(snapQuantity(2.4, plantains), 2.5);
    assert.equal(snapQuantity(0.1, plantains), 0.5);
    assert.equal(snapQuantity(25, plantains), 25);
    assert.equal(snapQuantity(50, plantains), 50);
    assert.equal(snapQuantity(100, plantains), 100);
    assert.equal(snapQuantity(100.5, plantains), 100);
  });

  it("rounds money for plantain examples", () => {
    assert.equal(lineSubtotal(2.49, 1), 2.49);
    assert.equal(lineSubtotal(2.49, 2), 4.98);
    assert.equal(lineSubtotal(2.49, 3), 7.47);
    assert.equal(lineSubtotal(2.49, 2.5), 6.23);
  });

  it("formats sell quantity with unit", () => {
    assert.equal(formatSellQuantity(3, "lb"), "3 lb");
    assert.equal(formatSellQuantity(2.5, "lb"), "2.5 lb");
  });

  it("converts purchased weight plus packaging for shipping", () => {
    assert.equal(
      lineShipWeightLb({ settings: plantains, quantity: 3 }),
      3.1,
    );
    assert.equal(
      lineShipWeightLb({
        settings: sellingSettingsFromProduct({
          selling_method: "weight",
          selling_unit: "kg",
          unit_increment: 0.5,
          min_sell_qty: 0.5,
          package_weight_lb: 0,
        }),
        quantity: 1,
      }),
      2.205,
    );
  });

  it("defaults existing products to each", () => {
    const settings = sellingSettingsFromProduct({});
    assert.equal(settings.sellingMethod, "each");
    assert.equal(settings.unitIncrement, 1);
  });
});
