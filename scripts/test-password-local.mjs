import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const logs=[];
let user=null;let updated=null;
const supabase={auth:{getUser:async()=>({data:{user}}),updateUser:async(payload)=>{updated=payload;return {error:null}}}};
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id)=>{if(id==='@/src/lib/supabase/server')return {createClient:async()=>supabase};throw Error(id)},console:{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))}},{filename:file});return exports;}
const {changeAuthenticatedPassword}=load('src/lib/auth/password.ts');
let n=0;async function test(name,fn){logs.length=0;updated=null;user={id:'u1'};await fn();n++;console.log('PASS '+name)}
await test('unauthenticated password change rejected',async()=>{user=null;const r=await changeAuthenticatedPassword({nextPassword:'abcdefgh',confirmPassword:'abcdefgh'});assert.equal(r.success,false);assert.equal(updated,null)});
await test('mismatch rejected',async()=>{const r=await changeAuthenticatedPassword({nextPassword:'abcdefgh',confirmPassword:'ijklmnop'});assert.equal(r.success,false);assert.equal(updated,null)});
await test('short password rejected',async()=>{const r=await changeAuthenticatedPassword({nextPassword:'short',confirmPassword:'short'});assert.equal(r.success,false);assert.equal(updated,null)});
await test('successful authenticated update',async()=>{const r=await changeAuthenticatedPassword({nextPassword:'newpass12',confirmPassword:'newpass12'});assert.equal(r.success,true);assert.equal(updated.password,'newpass12')});
await test('secrets never logged',async()=>{await changeAuthenticatedPassword({nextPassword:'secretpass',confirmPassword:'secretpass'});assert.equal(logs.some((line)=>line.includes('secretpass')),false)});
console.log(`${n} password tests passed.`);
