import assert from "node:assert/strict";
import { test } from "node:test";
import { cartCustomsReady, verifiedCustomsFields } from "./customs.ts";

test("international carts fail closed without verified customs fields", () => {
  assert.equal(verifiedCustomsFields({}), null);
  assert.equal(verifiedCustomsFields({ hs_code: "1006", origin_country_alpha2: "TH" })?.hsCode, "1006");
  const blocked = cartCustomsReady([{ name: "Rice" }, { name: "Fufu" }], true);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.match(blocked.message, /never invented/);
    assert.doesNotMatch(blocked.message, /unsupported/);
  }
  assert.equal(cartCustomsReady([{ name: "Rice" }], false).ok, true);
});
