import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const id='20000000-0000-4000-8000-000000000001';
let user, admin, order, calls, writes, failRead, stale, cachePaths;
const db={auth:{getUser:async()=>({data:{user}})},rpc:async()=>({data:true,error:null}),from(table){
 const filters={},q={operation:'read',select(columns){calls.push({table,columns});return q},eq(k,v){filters[k]=v;return q},update(payload){q.operation='update';q.payload=payload;return q},async maybeSingle(){
  if(failRead)return {data:null,error:{message:'private failure'}};
  if(q.operation==='update'){
   if(stale||filters.status!==order.status)return {data:null,error:null};
   writes.push(q.payload);order={...order,...q.payload};return {data:{id},error:null};
  }
  const matches=order&&Object.entries(filters).every(([k,v])=>order[k]===v);
  return {data:matches?{...order}:null,error:null};
 }};return q;
}};
const modules=new Map();
function load(file){if(modules.has(file))return modules.get(file);const exports={};const require=name=>{
 if(name==='server-only')return {};
 if(name==='@/src/lib/supabase/server')return {createClient:async()=>db};
 if(name==='@/src/lib/auth/guards')return {requireAdmin:async()=>{if(!admin)throw Error('unauthorized');return {supabase:db}}};
 if(name==='next/navigation')return {redirect:url=>{throw Error('redirect:'+url)}};
 if(name==='next/cache')return {revalidatePath:p=>cachePaths.push(p)};
 if(name.startsWith('@/'))return load(name.slice(2)+'.ts');
 if(name.startsWith('.'))return load(path.resolve(path.dirname(file), name)+'.ts');
 throw Error(name);
};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,URL,console,crypto:globalThis.crypto,process,FormData,fetch});modules.set(file,exports);return exports;}
const customer=load('src/lib/customer/orders.ts');
const actions=load('src/lib/catalog/actions.ts');
const status=load('src/lib/orders/status.ts');
const messages=load('src/lib/communications/order-messages.ts');
const payments=load('src/lib/payments/readiness.ts');
const emailActions=load('src/lib/admin/email-actions.ts');
const notify=load('src/lib/notifications/events.ts');
let count=0;
async function test(name,fn){user={id:'customer-a'};admin=true;calls=[];writes=[];cachePaths=[];failRead=false;stale=false;order={id,user_id:user.id,status:'pending',fulfillment_method:'delivery',payment_status:'pending'};await fn();count++;console.log('PASS '+name);}
const form=(next='confirmed',expected='pending')=>new Map([['id',id],['status',next],['expected_status',expected]]);
await test('customer reads own order',async()=>assert.equal((await customer.getCustomerOrder(id)).kind,'found'));
await test('another customer order is hidden even without mock RLS',async()=>{order.user_id='customer-b';assert.equal((await customer.getCustomerOrder(id)).kind,'missing')});
await test('guest cannot query order data',async()=>{user=null;assert.equal((await customer.getCustomerOrder(id)).kind,'unauthenticated');assert.equal(calls.length,0)});
await test('authenticated customer cannot read guest order',async()=>{order.user_id=null;assert.equal((await customer.getCustomerOrder(id)).kind,'missing')});
await test('invalid ID does not query orders',async()=>{assert.equal((await customer.getCustomerOrder('../admin')).kind,'missing');assert.equal(calls.length,0)});
await test('missing order is indistinguishable from another owner',async()=>{order=null;assert.equal((await customer.getCustomerOrder(id)).kind,'missing')});
await test('database failure is not a fake missing/empty order',async()=>{failRead=true;await assert.rejects(customer.getCustomerOrder(id),/Unable to load your order/)});
await test('customer projection excludes internal notes and customer email',async()=>{await customer.getCustomerOrder(id);assert.ok(!calls[0].columns.includes('*'));assert.ok(!calls[0].columns.includes('notes'));assert.ok(!calls[0].columns.includes('customer_email'))});
await test('non-admin cannot update orders',async()=>{admin=false;await assert.rejects(actions.updateOrderStatus(form()),/unauthorized/);assert.equal(writes.length,0)});
await test('allowed update preserves payment and refreshes customer view',async()=>{await assert.rejects(actions.updateOrderStatus(form()),/success=status_updated/);assert.equal(order.payment_status,'pending');assert.deepEqual(Object.keys(writes[0]),['status']);assert.ok(cachePaths.includes(`/account/orders/${id}`))});
await test('cannot skip directly from pending to completed',async()=>{await assert.rejects(actions.updateOrderStatus(form('delivered')),/invalid_transition/);assert.equal(writes.length,0)});
await test('terminal cancellation cannot reopen',async()=>{order.status='cancelled';await assert.rejects(actions.updateOrderStatus(form('confirmed','cancelled')),/invalid_transition/)});
await test('pickup cannot be shipped',async()=>{order.status='processing';order.fulfillment_method='local_pickup';await assert.rejects(actions.updateOrderStatus(form('shipped','processing')),/invalid_transition/)});
await test('stale form cannot update newer state',async()=>{order.status='confirmed';await assert.rejects(actions.updateOrderStatus(form('processing')),/invalid_transition/)});
await test('concurrent status race rejects zero-row update',async()=>{stale=true;await assert.rejects(actions.updateOrderStatus(form()),/status_update_failed/);assert.equal(writes.length,0)});
await test('pickup completion is labelled completed',()=>assert.equal(status.orderStatusLabel('delivered','local_pickup'),'Completed'));
const messageOrder=()=>({order_number:'IV-TEST',customer_email:'test@example.com',status:'pending',payment_status:'pending',fulfillment_method:'delivery',total:'24',order_items:[{product_name:'<script>alert(1)</script>',quantity:2}]});
await test('confirmation template escapes HTML and shows unpaid state',()=>{const m=messages.prepareOrderMessage('received',messageOrder());assert.ok(!m.html.includes('<script>'));assert.ok(m.html.includes('&lt;script&gt;'));assert.ok(m.text.includes('Payment: pending'));assert.ok(m.text.includes('$24.00'))});
await test('fulfillment and cancellation templates require actual matching state',()=>{assert.throws(()=>messages.prepareOrderMessage('fulfilled',messageOrder()));assert.throws(()=>messages.prepareOrderMessage('cancelled',messageOrder()));for(const [event,state]of [['fulfilled','delivered'],['cancelled','cancelled'],['status_updated','processing']])assert.ok(messages.prepareOrderMessage(event,{...messageOrder(),status:state}).text)});
await test('unconfigured email cannot claim sent',async()=>assert.equal((await messages.deliverOrderMessage()).sent,false));
await test('payment remains explicitly disabled without adapter',()=>assert.equal(payments.getPaymentReadiness().enabled,false));
await test('non-admin cannot preview or send test emails',async()=>{admin=false;await assert.rejects(emailActions.getAdminOrderEmailPreview(id),/unauthorized/);await assert.rejects(emailActions.sendAdminTestEmail(new FormData()),/unauthorized/)});
await test('admin email preview uses stored order and does not send',async()=>{
  order={...order,order_number:'IV-TEST',confirmation_code:'IVO-8K4P2',customer_email:'test@example.com',customer_name:'Ada',total:'24.00',order_items:[{product_name:'Rice',product_price:'12.00',quantity:2}]};
  const preview=await emailActions.getAdminOrderEmailPreview(id);
  assert.match(preview.text,/IVO-8K4P2/);
  assert.match(preview.text,/Payment pending/);
  assert.doesNotMatch(preview.text,/Payment received/);
});
await test('test email is blocked when provider is not configured',async()=>{
  const form=new FormData();form.set('recipient','qa@example.com');
  await assert.rejects(emailActions.sendAdminTestEmail(form),/email_not_configured/);
});
await test('fulfillment and payment map to existing status events',()=>{
  assert.equal(notify.notificationEventFromOrderStatus('processing'),'preparing');
  assert.equal(notify.notificationEventFromOrderStatus('ready_for_pickup'),'ready_for_pickup');
  assert.equal(notify.notificationEventFromOrderStatus('shipped'),'out_for_delivery');
  assert.equal(notify.notificationEventFromOrderStatus('delivered'),'completed');
  assert.equal(notify.notificationEventFromOrderStatus('cancelled'),'cancelled');
  assert.equal(notify.notificationEventFromPaymentStatus('paid'),'payment_received');
  assert.equal(notify.notificationEventFromPaymentStatus('failed'),'payment_failed');
  assert.equal(notify.notificationEventFromPaymentStatus('pending'),'payment_pending');
});
console.log(`${count} customer-order/admin/communications tests passed; database transport mocked, no emails or payments sent.`);
