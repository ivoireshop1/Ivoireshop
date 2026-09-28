import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let users;
let wishlist;
let products;
let failNext;
const supabase = {
  auth: { getUser: async () => ({ data: { user: users.current } }) },
  from(table) {
    const q = {
      _eq: {},
      select() { return this; },
      eq(key, value) { this._eq[key] = value; return this; },
      in() { return this; },
      order() { return this; },
      upsert(row) {
        this._op = 'upsert';
        this._row = row;
        return this;
      },
      delete() { this._op = 'delete'; return this; },
      then(resolve, reject) {
        try {
          if (failNext) {
            const message = failNext;
            failNext = null;
            return Promise.resolve({ data: null, error: { message } }).then(resolve, reject);
          }
          if (table === 'wishlist_items') {
            if (this._op === 'upsert') {
              const exists = wishlist.some((row) => row.user_id === this._row.user_id && row.product_id === this._row.product_id);
              if (!exists) wishlist.push({ id: `w-${wishlist.length + 1}`, ...this._row });
              return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            }
            if (this._op === 'delete') {
              wishlist = wishlist.filter((row) => !(row.user_id === this._eq.user_id && row.product_id === this._eq.product_id));
              return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            }
            const data = wishlist.filter((row) => row.user_id === this._eq.user_id);
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
          if (table === 'products') {
            return Promise.resolve({ data: products.filter((product) => product.is_active), error: null }).then(resolve, reject);
          }
          throw new Error(table);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      },
    };
    return q;
  },
};

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const require = (id) => {
    if (id === '@/src/lib/supabase/browser') return { createClient: () => supabase };
    if (id === '@/src/types/wishlist') return {};
    if (id === '@/src/types/catalog') return {};
    if (id === '@/src/lib/catalog/relation-utils') return { toOneRelation: (value) => (Array.isArray(value) ? value[0] : value) };
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require, console },
    { filename: file },
  );
  cache.set(file, exports);
  return exports;
}

const service = load('src/lib/wishlist/wishlist-service.ts');
let n = 0;
async function test(name, fn) {
  users = { current: { id: 'user-a' } };
  wishlist = [];
  products = [{ id: 'p1', name: 'Rice', slug: 'rice', description: '', short_description: null, price: 4, compare_at_price: null, is_active: true, is_featured: false, stock_quantity: 3, categories: { name: 'Foods' }, product_images: [{ image_url: '/rice.jpg', position: 0 }] }];
  failNext = null;
  await fn();
  n++;
  console.log('PASS ' + name);
}

await test('add persists for the signed-in user', async () => {
  await service.addToWishlist('p1');
  const items = await service.getWishlist();
  assert.equal(items.length, 1);
  assert.equal(items[0].productId, 'p1');
  assert.equal(items[0].product.name, 'Rice');
});
await test('duplicate add does not create a second row', async () => {
  await service.addToWishlist('p1');
  await service.addToWishlist('p1');
  assert.equal(wishlist.length, 1);
});
await test('list and remove', async () => {
  await service.addToWishlist('p1');
  assert.equal((await service.getWishlist()).length, 1);
  await service.removeFromWishlist('p1');
  assert.equal((await service.getWishlist()).length, 0);
});
await test('user isolation', async () => {
  await service.addToWishlist('p1');
  users.current = { id: 'user-b' };
  assert.equal((await service.getWishlist()).length, 0);
});
console.log(`${n} wishlist tests passed.`);
