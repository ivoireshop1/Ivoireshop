import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GUEST_ACCESS_TOKEN_RE,
  isGuestAccessToken,
  normalizeGuestOrderRefs,
} from "./guest-order-storage.ts";
import { isGuestOrderActive, isGuestOrderPast, partitionGuestOrders } from "./guest-order-lifecycle.ts";
import type { GuestOrderListItem } from "./guest-order-lifecycle.ts";

const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

test("guest access tokens must be 64 lowercase hex chars", () => {
  assert.equal(isGuestAccessToken(tokenA), true);
  assert.equal(GUEST_ACCESS_TOKEN_RE.test(tokenA), true);
  assert.equal(isGuestAccessToken("IVO-Z6EVV"), false);
  assert.equal(isGuestAccessToken("a".repeat(63)), false);
  assert.equal(isGuestAccessToken("A".repeat(64)), false);
  assert.equal(isGuestAccessToken(`${tokenA}!`), false);
});

test("normalizeGuestOrderRefs keeps only tokens and newest-first order", () => {
  const refs = normalizeGuestOrderRefs([
    { t: tokenA, a: 100 },
    { t: "bad", a: 200 },
    { t: tokenB, a: 300 },
    { t: tokenA, a: 400 },
    null,
    { email: "x@y.com", t: tokenB },
  ]);
  assert.equal(refs.length, 2);
  assert.equal(refs[0]?.t, tokenB);
  assert.equal(refs[1]?.t, tokenA);
  assert.equal(JSON.stringify(refs).includes("@"), false);
});

test("past vs active guest buckets never delete records — only classify", () => {
  assert.equal(isGuestOrderPast("delivered"), true);
  assert.equal(isGuestOrderPast("cancelled"), true);
  assert.equal(isGuestOrderActive("shipped"), true);
  assert.equal(isGuestOrderActive("ready_for_pickup"), true);

  const sample = (status: string, token: string): GuestOrderListItem => ({
    token,
    orderId: "00000000-0000-4000-8000-000000000001",
    orderNumber: "IV-1",
    confirmationCode: "IVO-TEST",
    status,
    paymentStatus: "paid",
    fulfillmentMethod: "delivery",
    total: 16.43,
    subtotal: 9.99,
    shippingCost: 6.44,
    taxAmount: 0,
    createdAt: "2026-10-19T00:00:00.000Z",
    items: [],
  });

  const { active, past } = partitionGuestOrders([
    sample("shipped", tokenA),
    sample("delivered", tokenB),
  ]);
  assert.equal(active.length, 1);
  assert.equal(past.length, 1);
  assert.equal(active[0]?.token, tokenA);
  assert.equal(past[0]?.token, tokenB);
});
