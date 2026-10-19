import assert from "node:assert/strict";
import { test } from "node:test";
import { liveOptionId, resolveSelectedShippingOption } from "./shippo.ts";
import type { DeliveryOption } from "../delivery/types.ts";

function live(partial: Partial<DeliveryOption> & Pick<DeliveryOption, "id" | "provider" | "amount">): DeliveryOption {
  return {
    fulfillmentMethod: "delivery",
    label: `${partial.provider.toUpperCase()} · ${partial.serviceCode || "Shipping"}`,
    mode: "api",
    rateMode: "live_api",
    testRate: true,
    ...partial,
  };
}

const ground = live({
  id: liveOptionId("ups", "Ground", { token: "ups_ground", days: 3 }),
  provider: "ups",
  amount: 13.64,
  serviceCode: "ups_ground",
  serviceToken: "ups_ground",
  etaDays: 3,
  shippoRateId: "r1",
});

test("live checkout revalidation refuses a missing quoted amount and a changed price", () => {
  const missing = resolveSelectedShippingOption([ground], ground.id, "delivery");
  assert.equal("error" in missing, true);
  if ("error" in missing) {
    assert.match(missing.error, /Confirm your shipping rate/i);
    assert.doesNotMatch(missing.error, /expired/i);
  }
  const changed = resolveSelectedShippingOption([ground], ground.id, "delivery", 9);
  assert.equal("error" in changed && changed.stale, true);
  const ok = resolveSelectedShippingOption([ground], ground.id, "delivery", 13.64);
  assert.equal("option" in ok, true);
});

test("UPS service rematches across ETA day drift when the quoted price still matches", () => {
  const selectedId = liveOptionId("ups", "Ground", { token: "ups_ground", days: 1 });
  const refreshed = live({
    id: liveOptionId("ups", "Ground", { token: "ups_ground", days: 3 }),
    provider: "ups",
    amount: 173.71,
    serviceCode: "ups_ground",
    serviceToken: "ups_ground",
    etaDays: 3,
    shippoRateId: "fresh-ups-ground",
  });
  const ok = resolveSelectedShippingOption([refreshed], selectedId, "delivery", 173.71);
  assert.equal("option" in ok, true);
  if ("option" in ok) {
    assert.equal(ok.option.shippoRateId, "fresh-ups-ground");
    assert.equal(ok.option.amount, 173.71);
  }
  const priceMoved = resolveSelectedShippingOption(
    [{ ...refreshed, amount: 180.05, shippoRateId: "newer" }],
    selectedId,
    "delivery",
    173.71,
  );
  assert.equal("error" in priceMoved && priceMoved.stale, true);
  if ("error" in priceMoved) assert.match(priceMoved.error, /changed/i);
});

test("UPS rematches when Shippo returns ground token without ups_ prefix at the same price", () => {
  const selectedId = liveOptionId("ups", "Ground", { token: "ups_ground", days: 4 });
  const alt = live({
    id: liveOptionId("ups", "Ground", { token: "ground", days: 5 }),
    provider: "ups",
    amount: 54.45,
    serviceCode: "Ground",
    serviceToken: "ground",
    etaDays: 5,
    shippoRateId: "alt-token",
  });
  const ok = resolveSelectedShippingOption([alt], selectedId, "delivery", 54.45);
  assert.equal("option" in ok, true);
  if ("option" in ok) assert.equal(ok.option.amount, 54.45);
});

test("manual options still resolve without a quoted live amount", () => {
  const manual: DeliveryOption = { ...ground, id: "pickup", provider: "pickup", fulfillmentMethod: "local_pickup", rateMode: "store_rate", amount: 0 };
  const ok = resolveSelectedShippingOption([manual], "pickup", "local_pickup");
  assert.equal("option" in ok, true);
});

test("multiple UPS and USPS services keep distinct identities and revalidate by service not object id", () => {
  const upsGround = live({
    id: liveOptionId("ups", "Shipping", { token: "ups_ground", days: 2 }),
    provider: "ups",
    amount: 11.96,
    serviceCode: "ups_ground",
    serviceToken: "ups_ground",
    etaDays: 2,
    shippoRateId: "old-ups-ground",
  });
  const upsNext = live({
    id: liveOptionId("ups", "Shipping", { token: "ups_next_day_air", days: 1 }),
    provider: "ups",
    amount: 82.43,
    serviceCode: "ups_next_day_air",
    serviceToken: "ups_next_day_air",
    etaDays: 1,
    shippoRateId: "old-ups-next",
  });
  const uspsPriority = live({
    id: liveOptionId("usps", "Shipping", { token: "usps_priority", days: 4 }),
    provider: "usps",
    amount: 7.09,
    serviceCode: "usps_priority",
    serviceToken: "usps_priority",
    etaDays: 4,
    shippoRateId: "old-usps",
  });
  const ivoire: DeliveryOption = {
    id: "ivoire:estimate",
    provider: "ivoire",
    fulfillmentMethod: "delivery",
    label: "Ivoire Shop Shipping",
    amount: 10.2,
    rateMode: "store_rate",
    mode: "manual",
  };
  const ids = [upsGround.id, upsNext.id, uspsPriority.id];
  assert.equal(new Set(ids).size, 3);

  const refreshed = [
    { ...upsGround, shippoRateId: "new-ups-ground" },
    { ...upsNext, shippoRateId: "new-ups-next" },
    { ...uspsPriority, shippoRateId: "new-usps", id: `${uspsPriority.id}:new-usps` },
    ivoire,
  ];
  const sameService = resolveSelectedShippingOption(refreshed, upsGround.id, "delivery", 11.96);
  assert.equal("option" in sameService && sameService.option.serviceToken, "ups_ground");
  const disambiguated = resolveSelectedShippingOption(refreshed, uspsPriority.id, "delivery", 7.09);
  assert.equal("option" in disambiguated && disambiguated.option.provider, "usps");
  const amountChanged = resolveSelectedShippingOption(
    [{ ...upsGround, amount: 14.1, shippoRateId: "newer" }],
    upsGround.id,
    "delivery",
    11.96,
  );
  assert.equal("error" in amountChanged && amountChanged.stale, true);
  const expired = resolveSelectedShippingOption([upsNext, ivoire], upsGround.id, "delivery", 11.96);
  assert.equal("error" in expired && expired.stale, true);
  const noSubstitute = resolveSelectedShippingOption([ivoire], upsGround.id, "delivery", 11.96);
  assert.equal("error" in noSubstitute, true);
  if ("option" in noSubstitute) assert.fail("must not accept a store estimate in place of a live carrier quote");
});
