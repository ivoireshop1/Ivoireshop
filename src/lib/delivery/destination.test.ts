import assert from "node:assert/strict";
import { test } from "node:test";
import {
  destinationReadyForCarrierQuotes,
  destinationReadyForLocalDelivery,
  incompleteCarrierQuoteMessage,
} from "./destination.ts";

test("local delivery is not a quote until city, ZIP, and country are present", () => {
  assert.equal(destinationReadyForLocalDelivery({ country: "US" }), false);
  assert.equal(destinationReadyForLocalDelivery({ city: "Atlanta", postal_code: "30308", country: "US" }), true);
});

test("UPS and USPS quotes require a complete US destination including a valid ZIP", () => {
  assert.equal(destinationReadyForCarrierQuotes({ country: "US", postal_code: "30308" }), false);
  assert.equal(
    destinationReadyForCarrierQuotes({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      state: "GA",
      postal_code: "abc",
      country: "US",
    }),
    false,
  );
  assert.equal(
    destinationReadyForCarrierQuotes({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      state: "GA",
      postal_code: "30308",
      country: "US",
    }),
    true,
  );
});

test("incomplete destinations keep a carrier prompt instead of a free local quote", () => {
  assert.match(incompleteCarrierQuoteMessage({ country: "US" }), /ZIP code/i);
  assert.match(
    incompleteCarrierQuoteMessage({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      postal_code: "12",
      country: "US",
    }),
    /valid U\.S\. ZIP/i,
  );
  assert.equal(
    incompleteCarrierQuoteMessage({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      postal_code: "30308",
      country: "US",
    }),
    "",
  );
});
