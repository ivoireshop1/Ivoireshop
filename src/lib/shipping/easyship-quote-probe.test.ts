import assert from "node:assert/strict";
import { test } from "node:test";
import { carrierUnavailableCopy, shippingProviderLabel } from "./provider.ts";
import {
  EASYSHIP_PRODUCTION_QUOTE_CONFIRM,
  easyshipProbeCooldownRemaining,
  easyshipQuoteProbeBlocker,
  parseEasyshipQuoteProbeDraft,
  rememberEasyshipProbe,
  easyshipProbeRemainingForAdmin,
} from "./easyship-quote-probe.ts";
import { easyshipApiMessage } from "./easyship.ts";

test("carrier unavailable copy names the selected provider instead of Shippo", () => {
  assert.match(carrierUnavailableCopy("ups", "easyship"), /Easyship did not return a UPS rate/);
  assert.doesNotMatch(carrierUnavailableCopy("ups", "easyship"), /Shippo|test rate/);
  assert.match(carrierUnavailableCopy("usps", "easypost"), /EasyPost did not return a USPS rate/);
  assert.match(carrierUnavailableCopy("ups", "shippo"), /Shippo did not return a UPS rate/);
  assert.equal(shippingProviderLabel("easyship"), "Easyship");
});

test("Easyship quote probe stays closed until founder measurements and confirmation", () => {
  const empty = parseEasyshipQuoteProbeDraft(new FormData());
  assert.match(easyshipQuoteProbeBlocker(empty) ?? "", /Confirm that this request/);
  const form = new FormData();
  form.set("acknowledge", "on");
  form.set("confirm", EASYSHIP_PRODUCTION_QUOTE_CONFIRM);
  form.set("weight_lb", "2.4");
  form.set("length_in", "12");
  form.set("width_in", "9");
  form.set("height_in", "6");
  form.set("declared_value", "8.11");
  form.set("dest_line_1", "100 Peachtree St");
  form.set("dest_city", "Atlanta");
  form.set("dest_state", "GA");
  form.set("dest_postal", "30303");
  const ready = parseEasyshipQuoteProbeDraft(form);
  assert.equal(easyshipQuoteProbeBlocker(ready), null);
  assert.deepEqual(ready.parcel, { weightLb: 2.4, lengthIn: 12, widthIn: 9, heightIn: 6 });
  form.set("weight_lb", "");
  assert.match(easyshipQuoteProbeBlocker(parseEasyshipQuoteProbeDraft(form)) ?? "", /never invented/);
  form.set("weight_lb", "900");
  form.set("length_in", "12");
  form.set("width_in", "9");
  form.set("height_in", "6");
  assert.match(easyshipQuoteProbeBlocker(parseEasyshipQuoteProbeDraft(form)) ?? "", /realistic/);
  form.set("weight_lb", "2.4");
  form.set("length_in", "200");
  assert.match(easyshipQuoteProbeBlocker(parseEasyshipQuoteProbeDraft(form)) ?? "", /realistic/);
});

test("Easyship quote probe cooldown blocks accidental repeat requests", () => {
  rememberEasyshipProbe("admin-test", 1_000);
  assert.equal(easyshipProbeCooldownRemaining(1_000, 1_000 + 30_000) > 0, true);
  assert.equal(easyshipProbeRemainingForAdmin("admin-test", 0, 1_000 + 30_000) > 0, true);
  assert.equal(easyshipProbeRemainingForAdmin("admin-test", 0, 1_000 + 121_000), 0);
});

test("Easyship API messages are sanitized and never invent a charge", () => {
  assert.match(easyshipApiMessage({ error: { message: "missing public.rate:read Bearer prod_secretvalue" } }), /public\.rate:read/);
  assert.doesNotMatch(easyshipApiMessage({ error: { message: "Bearer prod_secretvalue denied" } }), /prod_secretvalue/);
  assert.match(easyshipApiMessage({
    error: {
      code: "invalid_content",
      message: "The request body content is not valid.",
      details: ["#/components/schemas/ParcelItemRateCreate missing required parameters: category"],
    },
  }), /category/);
});
