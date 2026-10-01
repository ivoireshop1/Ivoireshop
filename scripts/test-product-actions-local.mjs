import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual TypeScript actions with an in-memory Supabase boundary.
// No AI API, network, credentials, or live database writes.
let product;
let images;
let writes;
let failImageInsert = false;
const supabase = { from(table) {
  let operation = 'select', payload, ids, shape = 'list';
  const query = {
    select() { return this; }, eq() { return this; },
    in(key, values) { ids = values; return this; },
    not() { return this; },
    update(value) { operation = 'update'; payload = value; return this; },
    insert(value) { operation = 'insert'; payload = value; return this; },
    delete() { operation = 'delete'; return this; },
    single() { shape = 'one'; return this; }, maybeSingle() { shape = 'one'; return this; },
    then(resolve, reject) {
      try {
        let data;
        if (table === 'categories') {
          data = {id:'c1', slug:'foods', is_active:true};
        } else if (table === 'products') {
          if (operation !== 'select') { writes.push({table, operation, payload}); product = {...product, ...payload}; }
          if (operation === 'select' && shape !== 'one') {
            data = product.sku ? [{ id: product.id, sku: product.sku }] : [];
          } else {
            data = {...product, product_images: images};
          }
        } else if (table === 'product_images') {
          if (operation === 'insert' && failImageInsert) return Promise.resolve({data:null,error:{message:'simulated storage-record failure'}}).then(resolve,reject);
          if (operation === 'insert') images.push(...payload.map((row,i)=>({...row,id:`new-${i}`})));
          if (operation === 'delete') images = images.filter(row => !ids?.includes(row.id));
          if (operation !== 'select') writes.push({table,operation,payload});
          data = images.map(row=>({...row}));
        }
        return Promise.resolve({data,error:null}).then(resolve,reject);
      } catch (error) { return Promise.reject(error).then(resolve,reject); }
    }
  };
  return query;
}};
const cache = new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require = (id) => {
    if(id==='next/cache') return {revalidatePath(){}};
    if(id==='next/navigation') return {redirect(url){throw new Error(`REDIRECT:${url}`);}};
    if(id==='server-only') return {};
    if(id==='@/src/lib/auth/guards') return {requireAdmin:async()=>({supabase})};
    if(id==='@/src/lib/communications/fulfillment-email') return {notifyFulfillmentEmail:async()=>false};
    if(id==='@/src/lib/notifications/record') return {recordFulfillmentNotification:async()=>{}};
    if(id.startsWith('@/')) return load(id.slice(2)+'.ts');
    throw Error(`Unexpected dependency: ${id}`);
  };
  vm.runInNewContext(code,{exports,require,URL,console,crypto:globalThis.crypto},{filename:file});
  cache.set(file,exports);return exports;
}
const actions=load('src/lib/catalog/admin-actions.ts');
const {saveProduct}=load('src/lib/catalog/actions.ts');
const {isPersistentImageUrl}=load('src/lib/catalog/image-url.ts');
function reset(){product={id:'p1',name:'Rice',slug:'rice',category_id:'c1',price:12,stock_quantity:8,track_inventory:true,is_active:false,is_featured:true};images=[{id:'old',image_url:'https://example.com/rice.jpg',position:0}];writes=[];failImageInsert=false;}
function form(overrides={}) {const data=new FormData(); for(const [key,value] of Object.entries({id:'p1',name:'Rice',category_id:'c1',price:'12',stock_quantity:'8',track_inventory:'on',status:'hidden',is_featured:'on',images_json:JSON.stringify(['https://example.com/rice.jpg']),...overrides})) { if(value===undefined) data.delete(key); else data.set(key,String(value));} return data;}
let count=0;
async function test(name,fn){reset();await fn();count++;console.log(`PASS ${name}`);}
await test('price-only update preserves stock, category, featured and draft',async()=>{const r=await actions.adminUpdateProductPricing('p1','15','8');assert.equal(r.success,true);assert.equal(product.price,15);assert.equal(product.stock_quantity,8);assert.equal(product.is_active,false);assert.equal(product.is_featured,true);assert.equal(product.category_id,'c1');});
await test('stock-only update preserves price and never publishes',async()=>{await actions.adminUpdateProductPricing('p1','12','20');assert.equal(product.price,12);assert.equal(product.stock_quantity,20);assert.equal(product.is_active,false);});
await test('zero stock preserves active and featured state',async()=>{product.is_active=true;await actions.adminUpdateProductPricing('p1','12','0');assert.equal(product.price,12);assert.equal(product.stock_quantity,0);assert.equal(product.is_active,true);assert.equal(product.is_featured,true);});
await test('blank inventory is not converted to zero',async()=>{const r=await actions.adminUpdateProductPricing('p1','12.99','');assert.equal(r.success,true);assert.equal(product.price,12.99);assert.equal(product.stock_quantity,null);});
await test('invalid money is rejected and does not write',async()=>{const r=await actions.adminUpdateProductPricing('p1','12.999','8');assert.equal(r.success,false);assert.equal(writes.length,0);assert.equal(product.price,12);});
await test('negative inventory is rejected',async()=>{const r=await actions.adminUpdateProductPricing('p1','12','-1');assert.equal(r.success,false);assert.equal(writes.length,0);});
await test('featured changes no other fields',async()=>{await actions.adminSetFeatured('p1',false);assert.equal(product.is_featured,false);assert.equal(product.stock_quantity,8);assert.equal(product.is_active,false);});
for(const field of ['name','category_id','price','stock_quantity','image'])await test(`activation rejects missing ${field}`,async()=>{if(field==='image')images=[];else product[field]=field==='name'||field==='category_id'?'':null;assert.equal((await actions.adminSetProductStatus('p1','active')).success,false);assert.equal(writes.length,0);});
await test('activation rejects temporary images and fractional stock',async()=>{images=[{image_url:'blob:temporary'}];assert.equal((await actions.adminSetProductStatus('p1','active')).success,false);images=[{image_url:'https://example.com/a.jpg'}];product.stock_quantity=1.5;assert.equal((await actions.adminSetProductStatus('p1','active')).success,false);});
await test('valid activation preserves featured/category/stock',async()=>{assert.equal((await actions.adminSetProductStatus('p1','active')).success,true);assert.equal(product.is_active,true);assert.equal(product.is_featured,true);assert.equal(product.category_id,'c1');assert.equal(product.stock_quantity,8);});
await test('actual draft save persists category and independent fields',async()=>{const r=await saveProduct(form({save_as_draft:'true',price:'',stock_quantity:'9'}));assert.equal(r.success,true);assert.equal(product.price,null);assert.equal(product.stock_quantity,9);assert.equal(product.category_id,'c1');assert.equal(product.is_active,false);assert.equal(product.is_featured,true);});
await test('actual publish saves persistent image records',async()=>{const r=await saveProduct(form({status:'active'}));assert.equal(r.success,true);assert.equal(product.is_active,true);assert.equal(images.length,1);assert.equal(images[0].image_url,'https://example.com/rice.jpg');});
await test('draft image removal persists empty gallery',async()=>{const r=await saveProduct(form({images_json:'[]'}));assert.equal(r.success,true);assert.equal(images.length,0);});
await test('image insertion failure preserves existing image records',async()=>{failImageInsert=true;const r=await saveProduct(form({status:'active'}));assert.equal(r.success,false);assert.equal(r.code,'product_save_failed');assert.equal(product.is_active,false);assert.equal(images[0].id,'old');assert.equal(images.length,1);});
await test('temporary image references rejected before database writes',async()=>{const r=await saveProduct(form({images_json:'["blob:temporary"]'}));assert.equal(r.success,false);assert.equal(r.code,'missing_image');assert.equal(writes.length,0);for(const url of ['blob:x','data:image/png;base64,x','javascript:alert(1)','//host/a'])assert.equal(isPersistentImageUrl(url),false);});
await test('every saved product requires category',async()=>{const r=await saveProduct(form({category_id:''}));assert.equal(r.success,false);assert.equal(r.code,'product_required');assert.equal(writes.length,0);});
await test('price-only save preserves quantity category and status',async()=>{const r=await saveProduct(form({price:'15.50'}));assert.equal(r.success,true);assert.equal(product.price,15.5);assert.equal(product.stock_quantity,8);assert.equal(product.category_id,'c1');assert.equal(product.is_active,false);});
await test('quantity-only save preserves price category and status',async()=>{const r=await saveProduct(form({stock_quantity:'4'}));assert.equal(r.success,true);assert.equal(product.price,12);assert.equal(product.stock_quantity,4);assert.equal(product.category_id,'c1');});
await test('failed save preserves form-bound product state',async()=>{failImageInsert=true;const before={...product};const r=await saveProduct(form({status:'active'}));assert.equal(r.success,false);assert.equal(product.price,before.price);assert.equal(product.stock_quantity,before.stock_quantity);});
await test('untracked publish does not require quantity',async()=>{
  const r=await saveProduct(form({status:'active',track_inventory:undefined,stock_quantity:''}));
  assert.equal(r.success,true);
  assert.equal(product.track_inventory,false);
  assert.equal(product.stock_quantity,null);
  assert.equal(product.is_active,true);
});
await test('untracked activation is allowed without stock',async()=>{
  product.track_inventory=false;product.stock_quantity=null;product.price=12;
  assert.equal((await actions.adminSetProductStatus('p1','active')).success,true);
});
await test('existing SKU is preserved on save',async()=>{
  product.sku='FOOD-KEEP1';
  const r=await saveProduct(form({sku:'COS-NEW01'}));
  assert.equal(r.success,true);
  assert.equal(product.sku,'FOOD-KEEP1');
});
await test('missing SKU is generated from Foods prefix and product id',async()=>{
  product.sku=null;
  const r=await saveProduct(form({sku:''}));
  assert.equal(r.success,true);
  assert.match(product.sku,/^FOOD-[A-Z0-9]+$/);
});
console.log(`${count} deterministic action tests passed; database/RLS/browser behavior is not exercised.`);
