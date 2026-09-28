import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
let uploads=0,storageError=null,authUser=null,role='customer';
const supabase={auth:{getUser:async()=>({data:{user:authUser}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{role},error:null})}),storage:{from:bucket=>({upload:async()=>{assert.equal(bucket,'product-images');uploads++;return {error:storageError}},getPublicUrl:()=>({data:{publicUrl:'https://example.supabase.co/storage/v1/object/public/product-images/test.png'}})})}};
function load(file,dependencies){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:id=>{if(id in dependencies)return dependencies[id];throw Error(id)},File,Buffer,console:{error(){}},Response,Request},{filename:file});return exports}
const guards=load('src/lib/auth/guards.ts',{'@/src/lib/supabase/server':{createClient:async()=>supabase},'next/navigation':{redirect:location=>{throw Error('redirect:'+location)}}});
const {POST}=load('app/api/admin/upload/route.ts',{'@/src/lib/auth/guards':guards,'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'node:path':path});
let n=0;async function test(name,fn){uploads=0;storageError=null;authUser={id:'admin-test'};role='admin';await fn();n++;console.log('PASS '+name)}
const request=(type='image/png')=>{const form=new FormData();form.append('files',new File(['test'],'test.png',{type}));return new Request('http://localhost/api/admin/upload',{method:'POST',body:form})};
await test('unauthenticated admin guard redirects',async()=>{authUser=null;await assert.rejects(guards.requireAdmin(),/login/)});
await test('non-admin guard redirects without bypass',async()=>{role='customer';await assert.rejects(guards.requireAdmin(),/unauthorized/)});
await test('admin guard accepts authenticated admin',async()=>{assert.equal((await guards.requireAdmin()).profile.role,'admin')});
await test('unauthorized upload cannot touch Storage',async()=>{authUser=null;assert.notEqual((await POST(request())).status,200);assert.equal(uploads,0)});
await test('invalid image type rejected',async()=>{assert.equal((await POST(request('text/plain'))).status,400);assert.equal(uploads,0)});
await test('Storage failure does not return fake local URL',async()=>{storageError={message:'NoSuchBucket'};const response=await POST(request());assert.equal(response.status,502);assert.equal((await response.json()).success,undefined)});
await test('successful upload returns persistent Storage reference',async()=>{const response=await POST(request());assert.equal(response.status,200);const data=await response.json();assert.equal(data.success,true);assert.match(data.urls[0],/^https:/);assert.equal(uploads,1)});
console.log(`${n} upload/auth tests passed with mocked Storage transport.`);
