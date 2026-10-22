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
  assert.match(incompleteCarrierQuoteMessage({ country: "US" }), /state or province|ZIP code/i);
  assert.match(
    incompleteCarrierQuoteMessage({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      state: "GA",
      postal_code: "12",
      country: "US",
    }),
    /valid U\.S\. ZIP/i,
  );
  assert.match(
    incompleteCarrierQuoteMessage({
      address_line_1: "100 Peachtree St",
      city: "Atlanta",
      postal_code: "30308",
      country: "US",
    }),
    /state or province/i,
  );
  assert.equal(
    incompleteCarrierQuoteMessage({
      address_line_1: "1 Main St",
      city: "Clayton",
      state: "OH",
      postal_code: "45315",
      country: "US",
    }),
    "",
  );
});

test("carrier quotes require a complete US, Canadian, or other international address before any request", () => {
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
  assert.equal(destinationReadyForCarrierQuotes({
    address_line_1: "10 Downing Street",
    city: "London",
    postal_code: "SW1A 2AA",
    country: "GB",
  }), true);
  assert.equal(destinationReadyForCarrierQuotes({
    address_line_1: "100 Queen St W",
    city: "Toronto",
    postal_code: "M5V 2T6",
    country: "CA",
  }), false);
  assert.doesNotMatch(
    incompleteCarrierQuoteMessage({
      address_line_1: "100 Queen St W",
      city: "Toronto",
      postal_code: "M5V 2T6",
      country: "CA",
    }),
    /unsupported/i,
  );
});
