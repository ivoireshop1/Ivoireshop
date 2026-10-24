import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RATE_TABLE_OVERWEIGHT_MESSAGE,
  applyRateTableBuffer,
  collectRateTableOptions,
  lookupRateTableAmount,
  parseRateTableConfig,
  rateTableCanOffer,
  rateTableIsComplete,
} from "./rate-table.ts";

const priced = {
  rate_table_enabled: true,
  rate_table_buffer: 0.1,
  rate_table: {
    ground: { 5: 8, 10: 12, 20: 18, 25: 24, 30: 30, 40: 38 },
    priority: { 5: 12, 10: 16, 20: 24, 25: 30, 30: 36, 40: 46 },
    express: { 5: 18, 10: 24, 20: 32, 25: 40, 30: 48, 40: 60 },
  },
};

test("rate table stays off and incomplete until founder prices every bracket", () => {
  const empty = parseRateTableConfig({});
  assert.equal(empty.enabled, false);
  assert.equal(empty.buffer, 0.1);
  assert.equal(rateTableIsComplete(empty), false);
  assert.equal(rateTableCanOffer(empty), false);
  assert.equal(rateTableCanOffer(parseRateTableConfig({ ...priced, rate_table_enabled: false })), false);
  assert.equal(rateTableCanOffer(parseRateTableConfig(priced)), true);
});

test("domestic brackets include 20-25, 25-30, and 30-40 lb and apply the 10% buffer", () => {
  const config = parseRateTableConfig(priced);
  assert.equal(lookupRateTableAmount(config, "ground", 22).ok, true);
  assert.equal(lookupRateTableAmount(config, "ground", 22).amount, applyRateTableBuffer(24, 0.1));
  assert.equal(lookupRateTableAmount(config, "ground", 29.49).amount, applyRateTableBuffer(30, 0.1));
  assert.equal(lookupRateTableAmount(config, "priority", 35).amount, applyRateTableBuffer(46, 0.1));
  assert.equal(lookupRateTableAmount(config, "express", 40).amount, applyRateTableBuffer(60, 0.1));
  assert.equal(lookupRateTableAmount(config, "ground", 40.01).reason, "overweight");
});

test("rate table never substitutes when a live carrier option is already present", () => {
  const silent = collectRateTableOptions({
    settings: priced,
    destinationCountry: "US",
    weightLb: 22,
    liveCarrierOptionsPresent: true,
  });
  assert.equal(silent.options.length, 0);
  assert.equal(silent.usedFallback, false);
});

test("enabled table is labeled STORE-CALCULATED and refuses Canada or 40+ lb invention", () => {
  const offered = collectRateTableOptions({
    settings: priced,
    destinationCountry: "US",
    weightLb: 6.165,
    liveCarrierOptionsPresent: false,
  });
  assert.equal(offered.usedFallback, true);
  assert.equal(offered.options.length, 3);
  assert.ok(offered.options.every((option) => option.rateMode === "rate_table"));
  assert.ok(offered.options.every((option) => option.label.startsWith("STORE-CALCULATED")));
  assert.ok(offered.options.every((option) => option.quoteSource === "rate_table"));
  assert.equal(collectRateTableOptions({
    settings: priced,
    destinationCountry: "CA",
    weightLb: 6.165,
    liveCarrierOptionsPresent: false,
  }).options.length, 0);
  const heavy = collectRateTableOptions({
    settings: priced,
    destinationCountry: "US",
    weightLb: 41,
    liveCarrierOptionsPresent: false,
  });
  assert.equal(heavy.options.length, 0);
  assert.equal(heavy.message, RATE_TABLE_OVERWEIGHT_MESSAGE);
});
