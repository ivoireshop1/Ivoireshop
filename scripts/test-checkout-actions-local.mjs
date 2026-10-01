import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
let rpcResult, rpcCalls, cachePaths, throwNetwork=false, cacheFailure=false, storeOpen=true, signedIn=false, throwNotification=false;
const local=new Map(),session=new Map();
const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)});
const cache=new Map();
const window={localStorage:storage(local)};
function load(file){
 if(cache.has(file))return cache.get(file);
 const exports={};
 const require=id=>{
  if(id==='next/cache')return {revalidatePath(p){if(cacheFailure)throw Error('cache');cachePaths.push(p)}};
  if(id==='server-only')return {};
  if(id==='node:crypto')return { createHmac, randomUUID: () => '00000000-0000-4000-8000-000000000099' };
  if(id==='@/src/lib/supabase/admin')return {createAdminClient:()=>null};
  if(id==='@/src/lib/communications/send-confirmation')return {trySendOrderConfirmation:async()=>false};
  if(id==='@/src/lib/supabase/server')return {createClient:async()=>({
    auth:{getUser:async()=>({data:{user:signedIn?{id:'30000000-0000-4000-8000-000000000001'}:null}})},
    from(){return {select(){return this},eq(){return this},in(){return this},maybeSingle:async()=>({data:{is_open:storeOpen,pickup_enabled:true,store_delivery_enabled:true}}),then(resolve){resolve({data:[]});}}},
    rpc:async(name,args)=>{rpcCalls.push({name,args});if(throwNetwork)throw Error('network');if(name==='create_customer_order_notification'){if(throwNotification)throw Error('notify');return {data:true,error:null};}return rpcResult;},
  })};
  if(id.startsWith('@/'))return load(id.slice(2)+'.ts');
  if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id)+'.ts');
  throw Error(id);
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require,URL,URLSearchParams,window,sessionStorage:storage(session),console,process,Buffer,fetch:async()=>({ok:false,status:501,json:async()=>({})})},{filename:file});
 cache.set(file,exports);return exports;
}
const {placeCheckoutOrder}=load('src/lib/checkout/actions.ts');
const {validateCheckout}=load('src/lib/checkout/checkout-validation.ts');
const cart=load('src/lib/cart/cart-storage.ts');
const sessions=load('src/lib/checkout/checkout-session.ts');
const {sanitizeReturnPath}=load('src/lib/navigation/smart-navigation.ts');
const id='20000000-0000-4000-8000-000000000001';
const request=()=>({items:[{product_id:id,quantity:2}],customerName:'Test',customerEmail:'test@example.com',customerPhone:'1234567890',address:{address_line_1:'1 Main St',city:'Test',country:'US'},fulfillmentMethod:'delivery',idempotencyKey:crypto.randomUUID()});
let count=0;
async function test(name,fn){rpcCalls=[];cachePaths=[];throwNetwork=false;cacheFailure=false;storeOpen=true;signedIn=false;throwNotification=false;local.clear();session.clear();rpcResult={data:[{order_id:id,order_number:'IV-TEST',status:'pending',total:'24.00'}],error:null};await fn();count++;console.log('PASS '+name)}
await test('actual action sends only IDs/quantities and uses RPC total',async()=>{const r=await placeCheckoutOrder({...request(),price:0.01,total:0.01});assert.equal(r.success,true);assert.equal(r.receipt.total,24);assert.equal(r.receipt.payment_status,'pending');assert.notEqual(r.receipt.payment_status,'paid');assert.equal(rpcCalls[0].name,'create_checkout_order');assert.deepEqual(Object.keys(rpcCalls[0].args.p_items[0]).sort(),['product_id','quantity']);assert.ok(!JSON.stringify(rpcCalls[0].args).includes('0.01'));});
await test('closed store rejects new orders before RPC',async()=>{storeOpen=false;const r=await placeCheckoutOrder(request());assert.equal(r.success,false);assert.match(r.error,/temporarily unavailable/);assert.equal(rpcCalls.length,0)});
await test('invalid contact rejected before RPC',async()=>{for(const change of [{customerName:''},{customerEmail:'bad'},{customerPhone:'bad'},{address:{}},{fulfillmentMethod:'invalid'}])assert.equal((await placeCheckoutOrder({...request(),...change})).success,false);assert.equal(rpcCalls.length,0)});
await test('invalid/stale cart shape rejected before RPC',async()=>{for(const items of [[],null,[{product_id:'bad',quantity:1}],[{product_id:id,quantity:-1}],[{product_id:id,quantity:1.2}]])assert.equal((await placeCheckoutOrder({...request(),items})).success,false);assert.equal(rpcCalls.length,0)});
await test('RPC rejection preserves actionable stock error',async()=>{rpcResult={data:null,error:{code:'P0001',message:'Some items are no longer available in the requested quantity.'}};const r=await placeCheckoutOrder(request());assert.equal(r.success,false);assert.equal(r.retrySame,false);assert.match(r.error,/requested quantity/);assert.equal(cachePaths.length,0)});
await test('network exceptions remain uncertain and retry same key',async()=>{throwNetwork=true;const r=await placeCheckoutOrder(request());assert.equal(r.success,false);assert.equal(r.retrySame,true)});
await test('API outage hides internal details and stays recoverable',async()=>{rpcResult={data:null,error:{code:'XX000',message:'private database failure'}};const r=await placeCheckoutOrder(request());assert.equal(r.success,false);assert.equal(r.retrySame,true);assert.ok(!r.error.includes('private'))});
await test('malformed RPC response cannot produce fake success',async()=>{for(const data of [null,[],[{order_id:id}],[{order_id:id,order_number:'N',status:'pending',total:'bad'}]]){rpcResult={data,error:null};assert.equal((await placeCheckoutOrder(request())).success,false)}});
await test('successful checkout revalidates catalog/admin/order paths',async()=>{await placeCheckoutOrder(request());for(const p of ['/admin','/admin/orders','/admin/inventory','/shop','/account',`/admin/orders/${id}`])assert.ok(cachePaths.includes(p))});
await test('cache error cannot undo an already committed order',async()=>{cacheFailure=true;assert.equal((await placeCheckoutOrder(request())).success,true)});
await test('guest checkout does not create in-app notifications',async()=>{await placeCheckoutOrder(request());assert.ok(!rpcCalls.some(call=>call.name==='create_customer_order_notification'))});
await test('signed-in checkout records confirmation and pending-payment notifications',async()=>{
  signedIn=true;
  const r=await placeCheckoutOrder(request());
  assert.equal(r.success,true);
  assert.equal(r.receipt.account_order,true);
  const notes=rpcCalls.filter(call=>call.name==='create_customer_order_notification');
  assert.equal(notes.length,2);
  assert.equal(notes[0].args.p_event_type,'order_confirmed');
  assert.equal(notes[1].args.p_event_type,'payment_pending');
  assert.ok(cachePaths.includes('/account/notifications'));
});
await test('guest checkout receipt is not an account order',async()=>{
  const r=await placeCheckoutOrder(request());
  assert.equal(r.success,true);
  assert.equal(r.receipt.account_order,false);
});
await test('notification failure cannot undo a committed order',async()=>{signedIn=true;throwNotification=true;assert.equal((await placeCheckoutOrder(request())).success,true)});
await test('duplicate cart lines aggregate and deterministic lock order',()=>{const r=request();r.items=[...r.items,...r.items];assert.equal(validateCheckout(r).request.items[0].quantity,4)});
const item={productId:id,slug:'rice',name:'Rice',price:12,image:'/rice.jpg',quantity:5};
await test('success removes purchased units, preserves added units and other products',()=>{const items=[item,{...item,productId:'other',quantity:1}];cart.saveCart(items);const remaining=cart.completeStoredPurchase(items,[{productId:id,quantity:2}],'order-1');assert.equal(remaining[0].quantity,3);assert.equal(remaining[1].quantity,1);assert.equal(cart.loadCart()[0].quantity,3)});
await test('receipt recovery cannot clear purchased quantities twice',()=>{cart.saveCart([item]);const once=cart.completeStoredPurchase([item],[{productId:id,quantity:2}],'order-1');const twice=cart.completeStoredPurchase(once,[{productId:id,quantity:2}],'order-1');assert.equal(twice[0].quantity,3);cart.saveCart(twice);assert.equal(cart.completeStoredPurchase(twice,[{productId:id,quantity:2}],'order-1')[0].quantity,3)});
await test('failed checkout leaves stored cart unchanged',async()=>{cart.saveCart([item]);throwNetwork=true;await placeCheckoutOrder(request());assert.equal(cart.loadCart()[0].quantity,5)});
await test('pending retry request and key survive reload',()=>{const pending={request:request(),items:[{productId:id,name:'Rice',quantity:2}],createdAt:Date.now()};sessions.storeCheckoutAttempt(pending);assert.equal(sessions.readCheckoutAttempt().request.idempotencyKey,pending.request.idempotencyKey);sessions.forgetCheckoutAttempt();assert.equal(sessions.readCheckoutAttempt(),null)});
await test('unsafe return paths rejected including control-character bypass',()=>{for(const value of ['//evil.test','/\\evil.test','/\t/evil.test','https://evil.test'])assert.equal(sanitizeReturnPath(value),'/shop');assert.equal(sanitizeReturnPath('/shop?category=Rice'),'/shop?category=Rice')});
console.log(`${count} checkout/action/cart/security tests passed; transport is mocked, not live Supabase.`);
