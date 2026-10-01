import assert from "node:assert/strict";
import { test } from "node:test";
import { displayOriginCountry, formatOriginLines, originFromSettings, originIsComplete, pickupLocationFromUnknown } from "./origin.ts";

test("formats United States from US country code", () => {
  const origin = originFromSettings({
    origin_name: "Ivoire Shop",
    origin_address_line_1: "1210 Rockbridge Rd NW",
    origin_address_line_2: "Unit L",
    origin_city: "Norcross",
    origin_state: "GA",
    origin_postal_code: "30093",
    origin_country: "US",
  });
  assert.equal(originIsComplete(origin), true);
  assert.deepEqual(formatOriginLines(origin), [
    "1210 Rockbridge Rd NW",
    "Unit L",
    "Norcross, GA 30093",
    "United States",
  ]);
  assert.equal(displayOriginCountry("US"), "United States");
});

test("reads nested pickup_location snapshots without rewriting missing history", () => {
  assert.equal(pickupLocationFromUnknown({ address_line_1: "Old" }), null);
  const found = pickupLocationFromUnknown({
    fulfillment_method: "local_pickup",
    pickup_location: {
      name: "Ivoire Shop",
      address_line_1: "1210 Rockbridge Rd NW",
      address_line_2: "Unit L",
      city: "Norcross",
      state: "GA",
      postal_code: "30093",
      country: "US",
    },
  });
  assert.ok(found);
  assert.equal(found.city, "Norcross");
});
