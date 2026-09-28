import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: () => { throw new Error('no'); } },
    { filename: file },
  );
  return exports;
}

const {
  parsePriceInput,
  parseStockInput,
  formatPriceDisplay,
  priceStatusFromDraft,
  inventoryStatusFromDraft,
  draftsReadyForActivation,
} = load('src/lib/catalog/pricing-input.ts');
let n = 0;
function test(name, fn) { fn(); n++; console.log('PASS ' + name); }

test('price draft 12.99 stays valid', () => {
  const parsed = parsePriceInput('12.99');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value, 12.99);
});
test('price remains while inventory string is independent', () => {
  assert.equal(parsePriceInput('12.99').value, 12.99);
  assert.equal(parseStockInput('500').value, 500);
});
test('inventory remains while price changes', () => {
  assert.equal(parseStockInput('600').value, 600);
  assert.equal(parsePriceInput('9.5').value, 9.5);
});
test('blank inventory is not zero', () => assert.equal(parseStockInput('').value, null));
test('decimal inventory rejected', () => assert.equal(parseStockInput('1.5').ok, false));
test('negative price rejected', () => assert.equal(parsePriceInput('-1').ok, false));
test('three decimals rejected', () => assert.equal(parsePriceInput('1.999').ok, false));
test('failed parse keeps caller drafts', () => {
  const draft = { price: '12.99', stock: '500' };
  const bad = parseStockInput('12.3');
  assert.equal(bad.ok, false);
  assert.equal(draft.price, '12.99');
  assert.equal(draft.stock, '500');
});
test('draft labels use current inputs not persisted zeros', () => {
  assert.equal(priceStatusFromDraft('16.99'), '$16.99');
  assert.equal(inventoryStatusFromDraft('500'), 'In stock');
  assert.equal(priceStatusFromDraft(''), 'Needs pricing');
  assert.equal(inventoryStatusFromDraft(''), 'Needs stock');
  assert.equal(inventoryStatusFromDraft('0'), 'Out of stock');
});
test('activation validates draft values', () => {
  const blocked = draftsReadyForActivation('', '0');
  assert.equal(blocked.ok, false);
  const ready = draftsReadyForActivation('16.99', '500');
  assert.equal(ready.ok, true);
});
test('price display uses two decimals without mutating cents', () => {
  assert.equal(formatPriceDisplay(16.4), '16.40');
  assert.equal(formatPriceDisplay(3), '3.00');
  assert.equal(formatPriceDisplay(2.99), '2.99');
  assert.equal(parsePriceInput('16.99').value, 16.99);
});
console.log(`${n} pricing-input tests passed.`);
