import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSupportedStoreCurrency,
  isValidSupportEmail,
  isValidWarehousePhone,
  parseStorefrontUrl,
  profileFromSettingsRow,
} from "./profile-shared.ts";

describe("store profile shared", () => {
  it("accepts only USD as supported currency", () => {
    assert.equal(isSupportedStoreCurrency("USD"), true);
    assert.equal(isSupportedStoreCurrency("EUR"), false);
  });

  it("validates support email and phone", () => {
    assert.equal(isValidSupportEmail(""), true);
    assert.equal(isValidSupportEmail("owner@example.com"), true);
    assert.equal(isValidSupportEmail("not-an-email"), false);
    assert.equal(isValidWarehousePhone(""), true);
    assert.equal(isValidWarehousePhone("313-825-9887"), true);
    assert.equal(isValidWarehousePhone("123"), false);
  });

  it("parses storefront URLs", () => {
    const ok = parseStorefrontUrl("https://ivoireshop-steel.vercel.app/");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.url, "https://ivoireshop-steel.vercel.app");
    const bad = parseStorefrontUrl("not a url");
    assert.equal(bad.ok, false);
  });

  it("maps settings rows without inventing contact details", () => {
    const profile = profileFromSettingsRow({
      origin_name: "Ivoire Shop",
      storefront_url: "https://ivoireshop-steel.vercel.app",
      default_currency: "usd",
      support_email: null,
      origin_phone: "",
    });
    assert.equal(profile.supportEmail, "");
    assert.equal(profile.warehousePhone, "");
    assert.equal(profile.defaultCurrency, "USD");
  });
});
