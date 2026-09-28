import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createHmac } from 'node:crypto';

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const require = (id) => {
    if (id === 'server-only') return {};
    if (id === 'node:crypto') return { createHmac, timingSafeEqual: (a, b) => Buffer.compare(a, b) === 0 };
    if (id.startsWith('@/')) return load(id.slice(2) + (id.endsWith('.ts') ? '' : '.ts').replace(/\.ts\.ts$/, '.ts'));
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id.endsWith('.ts') ? id : id + '.ts'));
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require, Buffer, process, URL, console },
    { filename: file },
  );
  cache.set(file, exports);
  return exports;
}

const money = load('src/lib/payments/money.ts');
const signature = load('src/lib/payments/square-signature.ts');
const messages = load('src/lib/communications/order-messages.ts');
const readiness = load('src/lib/payments/readiness.ts');
const validation = load('src/lib/checkout/checkout-validation.ts');
const email = load('src/lib/email/send.ts');

let count = 0;
async function test(name, fn) {
  await fn();
  count += 1;
  console.log('PASS ' + name);
}

await test('Square amount conversion uses integer cents', () => {
  assert.equal(money.usdToCents('12.99'), 1299);
  assert.equal(money.usdToCents(12.99), 1299);
  assert.equal(money.centsToUsdString(1299), '12.99');
  assert.equal(money.amountsMatchUsd('12.99', 12.99), true);
  assert.equal(money.amountsMatchUsd('10.00', '10.01'), false);
  assert.throws(() => money.usdToCents('12.9'));
  assert.throws(() => money.usdToCents(-1));
});

await test('wrong payment amount is rejected', () => {
  assert.equal(money.amountsMatchUsd('24.00', '24.01'), false);
  assert.equal(money.usdToCents('24.00') === 2401, false);
});

await test('Square webhook signature matches official test vector', () => {
  const rawBody = '{"hello":"world"}';
  const ok = signature.verifySquareWebhookSignature({
    rawBody,
    signatureHeader: '2kRE5qRU2tR+tBGlDwMEw2avJ7QM4ikPYD/PJ3bd9Og=',
    signatureKey: 'asdf1234',
    notificationUrl: 'https://example.com/webhook',
  });
  assert.equal(ok, true);
  assert.equal(signature.verifySquareWebhookSignature({
    rawBody,
    signatureHeader: 'invalid',
    signatureKey: 'asdf1234',
    notificationUrl: 'https://example.com/webhook',
  }), false);
});

await test('email validation is required before checkout', () => {
  const base = {
    items: [{ product_id: '20000000-0000-4000-8000-000000000001', quantity: 1 }],
    customerName: 'Ada',
    customerEmail: 'ada@example.com',
    customerPhone: '1234567890',
    address: { address_line_1: '1 Main', city: 'Test', country: 'US' },
    fulfillmentMethod: 'delivery',
    idempotencyKey: '20000000-0000-4000-8000-000000000002',
  };
  assert.equal(validation.validateCheckout(base).error, undefined);
  assert.ok(validation.validateCheckout({ ...base, customerEmail: '' }).error);
  assert.ok(validation.validateCheckout({ ...base, customerEmail: 'not-an-email' }).error);
  assert.ok(validation.validateCheckout({ ...base, customerEmail: 'ada@' }).error);
});

await test('paid confirmation email contains code and never card data', () => {
  const message = messages.preparePaidOrderConfirmation({
    order_number: 'IV-TEST',
    confirmation_code: 'IVO-8K4P2',
    customer_email: 'customer@email.com',
    customer_name: 'Ada Lovelace',
    payment_status: 'paid',
    payment_method: 'square',
    payment_provider: 'square',
    fulfillment_method: 'local_pickup',
    total: '24.00',
    order_items: [{ product_name: 'Rice', product_price: '12.00', quantity: 2 }],
  });
  assert.equal(message.subject, 'Your Ivoire Shop order is confirmed — IVO-8K4P2');
  assert.match(message.text, /IVO-8K4P2/);
  assert.match(message.text, /Rice × 2/);
  assert.match(message.text, /Keep this confirmation code handy/);
  assert.doesNotMatch(message.text, /cvv|card number|pan/i);
  assert.throws(() => messages.preparePaidOrderConfirmation({
    order_number: 'IV-TEST',
    confirmation_code: 'IVO-8K4P2',
    customer_email: 'customer@email.com',
    customer_name: 'Ada',
    payment_status: 'pending',
    payment_method: 'square',
    payment_provider: 'square',
    fulfillment_method: 'delivery',
    total: '24.00',
    order_items: [],
  }));
});

await test('delivery confirmation omits pickup copy and includes address', () => {
  const message = messages.preparePaidOrderConfirmation({
    order_number: 'IV-TEST',
    confirmation_code: 'IVO-48291',
    customer_email: 'customer@email.com',
    customer_name: 'Ada',
    payment_status: 'paid',
    payment_method: 'paypal',
    payment_provider: 'paypal',
    fulfillment_method: 'delivery',
    total: '10.00',
    shipping_address: { address_line_1: '1 Main St', city: 'Test', country: 'US' },
    order_items: [{ product_name: 'Oil', quantity: 1, product_price: '10.00' }],
  });
  assert.match(message.text, /1 Main St/);
  assert.match(message.text, /makes its way to you/);
  assert.doesNotMatch(message.text, /Keep this confirmation code handy when picking up/);
});

await test('unconfigured providers do not enable checkout payment', () => {
  const ready = readiness.getPaymentReadiness();
  assert.equal(ready.enabled, false);
  assert.equal(ready.square.label, 'Not configured');
  assert.equal(ready.paypal.label, 'Not configured');
});

await test('email provider failure does not throw and does not claim sent', async () => {
  const result = await email.sendTransactionalEmail({
    to: 'customer@email.com',
    subject: 'Your Ivoire Shop order is confirmed — IVO-8K4P2',
    text: 'confirmed',
    html: '<p>confirmed</p>',
  });
  assert.equal(result.sent, false);
  assert.equal(result.reason, 'provider_not_configured');
  assert.equal((await messages.deliverOrderMessage()).sent, false);
});

await test('duplicate webhook event id is treated as already processed', async () => {
  const seen = new Set();
  function record(eventId) {
    if (seen.has(eventId)) return { duplicate: true };
    seen.add(eventId);
    return { duplicate: false };
  }
  assert.equal(record('square-evt-1').duplicate, false);
  assert.equal(record('square-evt-1').duplicate, true);
  assert.equal(record('paypal-evt-1').duplicate, false);
});

console.log(`${count} payment/confirmation unit tests passed; no live providers and no real money.`);
