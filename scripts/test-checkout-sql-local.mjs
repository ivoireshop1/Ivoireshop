import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const moduleUrl=process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : new URL('../../.batch2-validation/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).href;
const {PGlite}=await import(moduleUrl);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
const migration=file=>fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
// pgcrypto extension creation is omitted only in this WASM runtime; gen_random_uuid is built in.
await db.exec(migration('20260912013000_initial_schema.sql').replace('create extension if not exists "pgcrypto";',''));
await db.exec(migration('20260912020000_create_checkout_order.sql'));
await db.exec(`alter table products alter column stock_quantity drop not null, alter column price drop not null; grant usage on schema public,auth to anon,authenticated; grant select,insert,update,delete on all tables in schema public to anon,authenticated;`);
const a='20000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
const user='30000000-0000-4000-8000-000000000001';
await db.exec(`insert into auth.users(id,email) values('${user}','customer@example.com'); insert into categories(id,name,slug) values('10000000-0000-4000-8000-000000000001','Test','test'); insert into products(id,name,slug,category_id,price,stock_quantity) values('${a}','Rice','rice','10000000-0000-4000-8000-000000000001',10,10),('${b}','Oil','oil','10000000-0000-4000-8000-000000000001',5,5);`);
async function checkout(items=[{product_id:a,quantity:2}],key=crypto.randomUUID(),options={}){
 const params=[items===null?null:JSON.stringify(items), options.name??'Test customer', options.email??'test@example.com',Object.hasOwn(options,'phone')?options.phone:'1234567890',Object.hasOwn(options,'address')?options.address:JSON.stringify({address_line_1:'1 Main St',city:'Test',country:'US'}),options.method??'delivery',key];
 return (await db.query('select * from create_checkout_order($1,$2,$3,$4,$5,$6,$7)',params)).rows[0];
}
const stock=async id=>(await db.query('select stock_quantity from products where id=$1',[id])).rows[0].stock_quantity;
let trackingReady=false;
async function reset(){await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); delete from order_items; delete from orders; update products set stock_quantity=10,price=10,is_active=true${trackingReady?',track_inventory=true':''}; update categories set is_active=true; do $$ begin if to_regclass('public.store_settings') is not null then update public.store_settings set is_open=true where id='default'; end if; if to_regclass('public.profiles') is not null then alter table public.profiles disable trigger profiles_prevent_role_change; update public.profiles set role='customer'; alter table public.profiles enable trigger profiles_prevent_role_change; end if; end $$;`);}
await reset();await db.exec(`update products set stock_quantity=null where id='${a}'`);assert.ok((await checkout()).order_id);console.log('REPRODUCED baseline: NULL stock accepted');
await reset();await db.exec(`update products set price='NaN' where id='${a}'`);assert.equal((await checkout()).total,'NaN');console.log('REPRODUCED baseline: non-finite database price accepted');
await reset();assert.equal(Number((await checkout(null)).total),0);console.log('REPRODUCED baseline: NULL cart creates zero-value order');
await reset();assert.ok((await checkout(undefined,undefined,{phone:null,address:null})).order_id);console.log('REPRODUCED baseline: missing phone/address accepted');
await reset();const leakedKey=crypto.randomUUID();const guest=await checkout(undefined,leakedKey);await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);assert.equal((await checkout(undefined,leakedKey)).order_id,guest.order_id);console.log('REPRODUCED baseline: checkout key replayed from a different auth identity');
await reset();await db.exec('set role anon');await assert.rejects(db.query('select * from products'),/permission denied for function is_admin/);console.log('REPRODUCED baseline: guest catalog RLS helper lacks EXECUTE permission');await db.exec('reset role');
await db.exec(migration('20260923010000_harden_existing_checkout.sql'));
await db.exec(migration('20260928020000_store_operations.sql'));
await db.exec(migration('20260928054603_optional_inventory_bulk_categories.sql'));
trackingReady=true;
await db.exec(migration('20260928185900_payment_status_cancelled.sql'));
await db.exec(migration('20260928190000_checkout_confirmation_payments.sql'));
await db.exec(migration('20260928210000_fix_confirmation_code_alphabet.sql'));
await db.exec(migration('20260928220000_customer_notifications.sql'));
let passed=0;
async function test(name,fn){await reset();await fn();passed++;console.log('PASS '+name);}
await test('quantity > 1 uses database price, ignoring browser price',async()=>{const r=await checkout([{product_id:a,quantity:3,price:0.01}]);assert.equal(Number(r.total),30);assert.equal(await stock(a),7);});
await test('multiple products and persisted order items',async()=>{const r=await checkout([{product_id:a,quantity:2},{product_id:b,quantity:3}]);assert.equal(Number(r.total),50);assert.equal(await stock(a),8);assert.equal(await stock(b),7);assert.equal((await db.query('select * from order_items where order_id=$1',[r.order_id])).rows.length,2);});
await test('exact remaining stock reaches zero',async()=>{await checkout([{product_id:a,quantity:10}]);assert.equal(await stock(a),0);});
await test('insufficient stock rolls back all prior decrements',async()=>{await assert.rejects(checkout([{product_id:a,quantity:2},{product_id:b,quantity:11}]),/requested quantity/);assert.equal(await stock(a),10);assert.equal((await db.query('select * from orders')).rows.length,0);});
await test('zero stock rejected',async()=>{await db.exec(`update products set stock_quantity=0 where id='${a}'`);await assert.rejects(checkout(),/requested quantity/);});
await test('NULL stock rejected',async()=>{await db.exec(`update products set stock_quantity=null where id='${a}'`);await assert.rejects(checkout(),/requested quantity/);});
await test('untracked product with NULL stock can checkout without decrement',async()=>{
  await db.exec(`update products set track_inventory=false, stock_quantity=null where id='${a}'`);
  const r=await checkout();
  assert.ok(r.order_id);
  assert.equal(await stock(a),null);
});
await test('untracked zero stock can checkout without decrement',async()=>{
  await db.exec(`update products set track_inventory=false, stock_quantity=0 where id='${a}'`);
  const r=await checkout();
  assert.ok(r.order_id);
  assert.equal(await stock(a),0);
});
await test('tracked checkout still decrements',async()=>{
  await db.exec(`update products set track_inventory=true, stock_quantity=10 where id='${a}'`);
  await checkout();
  assert.equal(await stock(a),8);
});
await test('NULL, zero and non-finite price rejected',async()=>{for(const price of ['null','0',"'NaN'"]){await db.exec(`update products set price=${price} where id='${a}'`);await assert.rejects(checkout(),/no longer available/);}});
await test('inactive product and category rejected',async()=>{await db.exec(`update products set is_active=false where id='${a}'`);await assert.rejects(checkout(),/no longer available/);await db.exec(`update products set is_active=true; update categories set is_active=false`);await assert.rejects(checkout(),/no longer available/);});
await test('NULL/empty/malformed carts rejected',async()=>{for(const cart of [null,[],{},[{product_id:a,quantity:0}],[{product_id:a,quantity:1.5}]])await assert.rejects(checkout(cart));});
await test('required contact and delivery fields rejected',async()=>{for(const options of [{name:''},{email:'invalid'},{phone:null},{phone:'abc'},{address:null},{address:'{}'},{address:'{"city":"Only city"}'}])await assert.rejects(checkout(undefined,undefined,options));});
await test('pickup works without delivery address',async()=>{assert.ok((await checkout(undefined,undefined,{method:'local_pickup',address:'{"fulfillment_method":"local_pickup"}'})).order_id);});
await test('same-key retries create one order and one stock decrement',async()=>{const key=crypto.randomUUID();const first=await checkout(undefined,key);const second=await checkout(undefined,key);assert.equal(first.order_id,second.order_id);assert.equal(await stock(a),8);assert.equal((await db.query('select * from orders')).rows.length,1);});
await test('duplicate product lines cannot oversell',async()=>{await assert.rejects(checkout([{product_id:a,quantity:6},{product_id:a,quantity:6}]),/requested quantity/);assert.equal(await stock(a),10);});
await test('authenticated order ownership and cross-user retry rejected',async()=>{await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);const key=crypto.randomUUID();const r=await checkout(undefined,key);assert.equal((await db.query('select user_id from orders where id=$1',[r.order_id])).rows[0].user_id,user);await db.exec(`select set_config('request.jwt.claim.sub','',false)`);await assert.rejects(checkout(undefined,key),/different session/);});
await test('guest catalog allowed; guest order reads hidden',async()=>{await db.exec('set role anon');await checkout();assert.equal((await db.query('select * from products')).rows.length,2);assert.equal((await db.query('select * from orders')).rows.length,0);await assert.rejects(db.query("insert into products(name,slug,category_id,price,stock_quantity) values('forbidden','forbidden','10000000-0000-4000-8000-000000000001',1,1)"),/row-level security/);});
await test('authenticated customer reads own orders only',async()=>{await checkout();await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);await checkout();await db.exec('set role authenticated');assert.equal((await db.query('select * from orders')).rows.length,1);assert.equal((await db.query('select * from order_items')).rows.length,1);});
await test('closed store rejects new orders',async()=>{await db.exec(`update store_settings set is_open=false where id='default'`);await assert.rejects(checkout(),/temporarily unavailable/);assert.equal(await stock(a),10);assert.equal((await db.query('select * from orders')).rows.length,0);});
await test('closed store still returns the same completed checkout key',async()=>{const key=crypto.randomUUID();const first=await checkout(undefined,key);await db.exec(`update store_settings set is_open=false where id='default'`);const second=await checkout(undefined,key);assert.equal(first.order_id,second.order_id);assert.equal(await stock(a),8);});
await test('bulk category move is admin-only and atomic',async()=>{
  const foods='10000000-0000-4000-8000-0000000000f1';
  const market='10000000-0000-4000-8000-0000000000f3';
  await db.exec(`insert into categories(id,name,slug,is_active) values('${foods}','Foods','foods',true),('${market}','Ivoire Market','ivoire-market',true) on conflict (slug) do update set is_active=true;`);
  await db.exec(`update products set category_id=(select id from categories where slug='foods'), price=12, stock_quantity=7, is_featured=true, is_active=true, slug='rice' where id='${a}'`);
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false); set role authenticated`);
  await assert.rejects(db.query("select admin_bulk_move_canonical_category(array['"+a+"']::uuid[], 'ivoire-market')"),/administrators|42501|row-level|permission/i);
  await db.exec("reset role");
  await db.exec(`alter table profiles disable trigger profiles_prevent_role_change; update profiles set role='admin' where id='${user}'; alter table profiles enable trigger profiles_prevent_role_change; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated`);
  const moved=(await db.query("select admin_bulk_move_canonical_category(array['"+a+"']::uuid[], 'ivoire-market') as n")).rows[0].n;
  assert.equal(Number(moved),1);
  await db.exec('reset role');
  const row=(await db.query(`select category_id, price, stock_quantity, is_featured, is_active, slug from products where id='${a}'`)).rows[0];
  assert.equal(row.category_id,(await db.query("select id from categories where slug='ivoire-market'")).rows[0].id);
  assert.equal(Number(row.price),12);
  assert.equal(row.stock_quantity,7);
  assert.equal(row.is_featured,true);
  assert.equal(row.is_active,true);
  assert.equal(row.slug,'rice');
});
await test('bulk move rejects inactive and unknown targets without changing rows',async()=>{
  await db.exec(`update categories set is_active=false where slug='ivoire-market'`);
  await db.exec(`alter table profiles disable trigger profiles_prevent_role_change; update profiles set role='admin' where id='${user}'; alter table profiles enable trigger profiles_prevent_role_change; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated`);
  const before=(await db.query(`select category_id from products where id='${a}'`)).rows[0].category_id;
  await assert.rejects(db.query("select admin_bulk_move_canonical_category(array['"+a+"']::uuid[], 'ivoire-market')"));
  await assert.rejects(db.query("select admin_bulk_move_canonical_category(array['"+a+"']::uuid[], 'rice-grains')"));
  await db.exec('reset role');
  assert.equal((await db.query(`select category_id from products where id='${a}'`)).rows[0].category_id,before);
});

await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); create schema storage;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select on storage.objects to anon;
grant select,insert,update,delete on storage.objects to authenticated;
insert into storage.buckets values('existing','existing',false);
insert into storage.objects(bucket_id,name) values('existing','keep.jpg');`);
await db.exec(migration('20260923000000_storage_product_images_bucket.sql'));
await test('Storage migration preserves existing objects and creates public bucket',async()=>{assert.equal((await db.query("select * from storage.objects where name='keep.jpg'")).rows.length,1);assert.equal((await db.query("select public from storage.buckets where id='product-images'")).rows[0].public,true)});
await test('non-admin cannot upload into product-images',async()=>{await db.exec(`select set_config('request.jwt.claim.sub','${user}',false);set role authenticated`);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('product-images','denied.jpg')"),/row-level security/)});
await test('admin upload allowed, public read scoped and bucket moves rejected',async()=>{
 await db.exec(`alter table profiles disable trigger profiles_prevent_role_change; update profiles set role='admin' where id='${user}'; alter table profiles enable trigger profiles_prevent_role_change; select set_config('request.jwt.claim.sub','${user}',false);set role authenticated`);
 await db.query("insert into storage.objects(bucket_id,name) values('product-images','admin.jpg')");
 await assert.rejects(db.query("update storage.objects set bucket_id='existing' where name='admin.jpg'"),/row-level security/);
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon");
 assert.equal((await db.query('select * from storage.objects')).rows.length,1);
});

await test('admin sees checkout customer/items/totals/stock and can update status',async()=>{
 const order=await checkout();
 await db.exec(`alter table profiles disable trigger profiles_prevent_role_change; update profiles set role='admin' where id='${user}'; alter table profiles enable trigger profiles_prevent_role_change; select set_config('request.jwt.claim.sub','${user}',false);set role authenticated`);
 const row=(await db.query('select * from orders where id=$1',[order.order_id])).rows[0];
 assert.equal(row.customer_name,'Test customer');assert.equal(row.customer_phone,'1234567890');assert.equal(row.fulfillment_method,'delivery');assert.equal(row.shipping_address.city,'Test');assert.equal(Number(row.subtotal),20);assert.equal(Number(row.total),20);
 assert.equal((await db.query('select quantity from order_items where order_id=$1',[order.order_id])).rows[0].quantity,2);
 await db.query("update orders set status='processing' where id=$1",[order.order_id]);
 assert.equal((await db.query('select status from orders where id=$1',[order.order_id])).rows[0].status,'processing');assert.equal(await stock(a),8);
});
await test('confirmation codes are unique, non-sequential, and returned from checkout',async()=>{
  const first=await checkout();
  const second=await checkout([{product_id:b,quantity:1}]);
  assert.match(first.confirmation_code,/^IVO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  assert.match(second.confirmation_code,/^IVO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  assert.notEqual(first.confirmation_code,second.confirmation_code);
  assert.notEqual(first.confirmation_code,'IVO-00001');
  assert.equal(first.guest_access_token.length,64);
  await assert.rejects(db.query('update orders set confirmation_code=$1 where id=$2',[first.confirmation_code,second.order_id]));
});
await test('guest cannot read orders by confirmation code and token lookup is required',async()=>{
  const order=await checkout();
  await db.exec('set role anon');
  assert.equal((await db.query('select * from orders')).rows.length,0);
  assert.equal((await db.query('select * from get_checkout_confirmation($1)',[order.confirmation_code])).rows.length,0);
  const found=(await db.query('select * from get_checkout_confirmation($1)',[order.guest_access_token])).rows;
  assert.equal(found.length,1);
  assert.equal(found[0].confirmation_code,order.confirmation_code);
  await assert.rejects(db.query('select lookup_order_by_confirmation_code($1)',[order.confirmation_code]));
});
await test('pickup checkout still generates a confirmation code',async()=>{
  const order=await checkout(undefined,undefined,{method:'local_pickup',address:'{"fulfillment_method":"local_pickup"}'});
  assert.match(order.confirmation_code,/^IVO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
  assert.equal(order.fulfillment_method,'local_pickup');
});
await test('guest checkout does not create in-app notifications',async()=>{
  const order=await checkout();
  assert.equal((await db.query('select create_customer_order_notification($1,$2,false)',[order.order_id,'order_confirmed'])).rows[0].create_customer_order_notification,null);
  assert.equal((await db.query('select * from customer_notifications')).rows.length,0);
});
await test('signed-in order notifications are isolated, idempotent, and markable as read',async()=>{
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);
  const order=await checkout();
  const first=(await db.query('select create_customer_order_notification($1,$2,false) as id',[order.order_id,'order_confirmed'])).rows[0].id;
  const second=(await db.query('select create_customer_order_notification($1,$2,true) as id',[order.order_id,'order_confirmed'])).rows[0].id;
  assert.equal(first,second);
  assert.equal((await db.query('select * from customer_notifications')).rows.length,1);
  await db.query('select create_customer_order_notification($1,$2,false)',[order.order_id,'preparing']);
  await db.exec(`select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000099',false)`);
  await assert.rejects(db.query('select create_customer_order_notification($1,$2,false)',[order.order_id,'ready_for_pickup']));
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from customer_notifications')).rows.length,0);
  await db.exec("reset role; select set_config('request.jwt.claim.sub','"+user+"',false); set role authenticated");
  assert.equal((await db.query('select * from customer_notifications')).rows.length,2);
  assert.equal((await db.query('select mark_customer_notifications_read(null)')).rows[0].mark_customer_notifications_read,2);
  await db.exec('reset role');
});
await test('anon cannot read customer notifications',async()=>{
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);
  const order=await checkout();
  await db.query('select create_customer_order_notification($1,$2,false)',[order.order_id,'order_confirmed']);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from customer_notifications'));
  await db.exec('reset role');
});
await test('customers cannot rewrite notification content',async()=>{
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);
  const order=await checkout();
  await db.query('select create_customer_order_notification($1,$2,false)',[order.order_id,'order_confirmed']);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("update customer_notifications set title='hacked'"),/Notifications can only be marked read|42501/);
  await db.exec('reset role');
});
await test('payment received notification requires stored paid status',async()=>{
  await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);
  const order=await checkout();
  assert.equal((await db.query('select create_customer_order_notification($1,$2,false) as id',[order.order_id,'payment_received'])).rows[0].id,null);
  await db.exec(`update orders set payment_status='paid' where id='${order.order_id}'`);
  assert.ok((await db.query('select create_customer_order_notification($1,$2,false) as id',[order.order_id,'payment_received'])).rows[0].id);
});
// PGlite is single-session: simultaneous independent-connection row-lock behavior is NOT claimed.
const sql=migration('20260923010000_harden_existing_checkout.sql');assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/for update of p/);assert.match(sql,/order by value ->> 'product_id'/);
console.log(`${passed} actual PostgreSQL tests passed. Multi-connection concurrency and remote migration state remain NOT VERIFIED.`);
await db.close();
