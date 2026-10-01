import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const require = (id) => {
    if (id === 'server-only') return {};
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

const tax = load('src/lib/tax/totals.ts');
const labels = load('src/lib/delivery/labels.ts');
const announcements = load('src/lib/admin/announcement-helpers.ts');
const events = load('src/lib/notifications/events.ts');

let count = 0;
async function test(name, fn) {
  await fn();
  count += 1;
  console.log('PASS ' + name);
}

await test('tax label never uses mock GA 7%', () => {
  assert.equal(tax.taxDisplayLabel({ tax_mode: 'not_configured', tax_rate_percent: null, tax_applies_to_shipping: false, tax_name: 'Tax' }), 'Tax (not configured)');
  assert.equal(tax.taxDisplayLabel({ tax_mode: 'manual_rate', tax_rate_percent: 8.25, tax_applies_to_shipping: true, tax_name: 'Sales tax' }), 'Sales tax (8.25%)');
  assert.equal(tax.taxDisplayLabel({ tax_mode: 'no_tax', tax_rate_percent: 7, tax_applies_to_shipping: false, tax_name: 'Tax' }), 'Tax');
});

await test('USPS to UPS shipping tax and total update from checkout math', () => {
  const settings = { tax_mode: 'manual_rate', tax_rate_percent: 7, tax_applies_to_shipping: true, tax_name: 'Tax' };
  const subtotal = 2000;
  const usps = 599;
  const ups = 1299;
  const taxUsps = tax.computeTaxCents({ subtotalCents: subtotal, discountCents: 0, shippingCents: usps, tax: settings });
  const taxUps = tax.computeTaxCents({ subtotalCents: subtotal, discountCents: 0, shippingCents: ups, tax: settings });
  const totalUsps = tax.computeOrderTotalCents({ subtotalCents: subtotal, discountCents: 0, shippingCents: usps, taxCents: taxUsps });
  const totalUps = tax.computeOrderTotalCents({ subtotalCents: subtotal, discountCents: 0, shippingCents: ups, taxCents: taxUps });
  assert.notEqual(usps, ups);
  assert.notEqual(taxUsps, taxUps);
  assert.notEqual(totalUsps, totalUps);
  assert.equal(totalUsps, subtotal + usps + taxUsps);
  assert.equal(totalUps, subtotal + ups + taxUps);
});

await test('shipping method copy matches locked checkout labels', () => {
  assert.equal(labels.shippingMethodCopy({ provider: 'pickup', amount: 0 }).title, 'Store Pickup');
  assert.equal(labels.shippingMethodCopy({ provider: 'pickup', amount: 0 }).price, 'FREE');
  assert.equal(labels.shippingSummaryLabel('usps'), 'Shipping (USPS)');
  assert.equal(labels.shippingSummaryLabel('ups'), 'Shipping (UPS)');
});

await test('announcement paths reject off-site URLs', () => {
  assert.equal(announcements.sanitizeAnnouncementPath('/shop'), '/shop');
  assert.equal(announcements.sanitizeAnnouncementPath('https://example.com/hours'), 'https://example.com/hours');
  assert.equal(announcements.sanitizeAnnouncementPath('https://evil.example'), 'https://evil.example/');
  assert.equal(announcements.sanitizeAnnouncementPath('javascript:alert(1)'), null);
  assert.equal(announcements.sanitizeAnnouncementPath('//evil.example'), null);
  assert.equal(announcements.sanitizeAnnouncementPath(''), null);
});

await test('announcement status mapping keeps history-friendly labels', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  assert.equal(announcements.displayAnnouncementStatus({ status: 'published', archived_at: null, starts_at: null, ends_at: '2026-09-01T00:00:00Z', published_at: '2026-08-01T00:00:00Z' }, now), 'expired');
  assert.equal(announcements.displayAnnouncementStatus({ status: 'draft', archived_at: null, starts_at: null, ends_at: null, published_at: '2026-08-01T00:00:00Z' }, now), 'draft');
  assert.equal(announcements.displayAnnouncementStatus({ status: 'published', archived_at: null, starts_at: '2026-10-02T00:00:00Z', ends_at: null, published_at: '2026-10-01T00:00:00Z' }, now), 'scheduled');
});

await test('order notification events include tracking_added', () => {
  assert.equal(events.notificationEvents.includes('tracking_added'), true);
  assert.equal(events.notificationEventFromOrderStatus('shipped'), 'out_for_delivery');
  assert.equal(events.notificationEventFromOrderStatus('processing'), 'preparing');
});

await test('admin money parser rejects negatives and keeps empty optional', () => {
  const money = load('src/lib/delivery/manual.ts');
  const empty = money.parseAdminMoney('');
  const valid = money.parseAdminMoney('9.99');
  const miles = money.parseAdminMiles('12.5');
  assert.equal(empty.ok, true);
  assert.equal(empty.amount, null);
  assert.equal(valid.ok, true);
  assert.equal(valid.amount, 9.99);
  assert.equal(money.parseAdminMoney('-1').ok, false);
  assert.equal(money.parseAdminMiles('501').ok, false);
  assert.equal(miles.ok, true);
  assert.equal(miles.amount, 12.5);
});

await test('admin announcements page can render an empty list without treating it as a load failure', () => {
  const page = fs.readFileSync('app/admin/announcements/page.tsx', 'utf8');
  const manager = fs.readFileSync('src/components/admin/customer-announcement-manager.tsx', 'utf8');
  const actions = fs.readFileSync('src/lib/admin/customer-announcement-actions.ts', 'utf8');
  assert.match(manager, /No announcements yet/);
  assert.match(manager, /Create Announcement/);
  assert.match(page, /ADM-ANNOUNCEMENTS-LOAD/);
  assert.doesNotMatch(page, /AdminSaveButton/);
  assert.match(actions, /"use server"/);
  assert.match(actions, /export async function createCustomerAnnouncement/);
  assert.match(actions, /export async function updateCustomerAnnouncement/);
  assert.match(actions, /export async function setCustomerAnnouncementStatus/);
  const helpers = load('src/lib/admin/announcement-helpers.ts');
  assert.equal(helpers.toDatetimeLocalValue(null), '');
  assert.equal(helpers.toDatetimeLocalValue('not-a-date'), '');
});

await test('UPS appears from persisted settings without hiding USPS when show_at_checkout is false', () => {
  const delivery = load('src/lib/delivery/manual.ts');
  const settings = {
    ups_enabled: true,
    ups_show_at_checkout: true,
    ups_domestic_enabled: true,
    ups_domestic_charge: 14.66,
    ups_rate_mode: 'store_rate',
    usps_enabled: true,
    usps_show_at_checkout: false,
    usps_domestic_enabled: true,
    usps_domestic_charge: 19.33,
    usps_rate_mode: 'store_rate',
  };
  const options = delivery.manualCarrierOptions(settings, 'US', 20);
  assert.equal(options.some((option) => option.provider === 'ups' && option.amount === 14.66), true);
  assert.equal(options.some((option) => option.provider === 'usps'), false);
  const hidden = delivery.manualCarrierOptions({ ...settings, ups_show_at_checkout: false }, 'US', 20);
  assert.equal(hidden.some((option) => option.provider === 'ups'), false);
});

console.log(`${count} tests passed`);
