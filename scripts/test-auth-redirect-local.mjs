import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file){
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id)=>{
    if(id==='@/src/lib/navigation/smart-navigation') return load('src/lib/navigation/smart-navigation.ts');
    throw Error(id);
  }},{filename:file});
  return exports;
}
const {CUSTOMER_HOME,resolvePostLoginPath}=load('src/lib/auth/post-login.ts');
const {sanitizeReturnPath}=load('src/lib/navigation/smart-navigation.ts');
const {isPasswordRecoveryPath}=load('src/lib/auth/recovery.ts');
const {mapAuthCallbackQueryError,mapAuthProviderFailure,publicAuthActionMessage}=load('src/lib/auth/customer-auth-messages.ts');
const {resolveHomeHref,resolveStorefrontHomeHref}=(()=>{
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/auth/session-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(id)=>{
    if(id==='@/src/lib/auth/post-login') return load('src/lib/auth/post-login.ts');
    throw Error(id);
  }},{filename:'src/lib/auth/session-navigation.ts'});
  return exports;
})();
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name)}
test('admin login defaults to /admin',()=>assert.equal(resolvePostLoginPath('admin',null),'/admin'));
test('customer login defaults to /account',()=>assert.equal(resolvePostLoginPath('customer',null),'/account'));
test('signed-in customer Home destination is /account',()=>assert.equal(CUSTOMER_HOME,'/account'));
test('customer admin next is denied',()=>assert.equal(resolvePostLoginPath('customer','/admin'),'/account'));
test('customer nested admin next is denied',()=>assert.equal(resolvePostLoginPath('customer','/admin/products'),'/account'));
test('unauthenticated admin path remains a login next candidate',()=>assert.equal(sanitizeReturnPath('/admin','/account'),'/admin'));
test('safe customer next is preserved',()=>assert.equal(resolvePostLoginPath('customer','/account#security'),'/account#security'));
test('malicious external next is rejected for customers',()=>assert.equal(resolvePostLoginPath('customer','https://evil.test'),'/account'));
test('protocol-relative next is rejected',()=>assert.equal(resolvePostLoginPath('admin','//evil.test'),'/admin'));
test('admin safe admin next is preserved',()=>assert.equal(resolvePostLoginPath('admin','/admin/orders'),'/admin/orders'));
test('admin is not sent to account by generic next',()=>assert.equal(resolvePostLoginPath('admin','/account'),'/admin'));
test('guest storefront Home is /',()=>assert.equal(resolveStorefrontHomeHref('guest'),'/'));
test('customer storefront Home is /account',()=>assert.equal(resolveStorefrontHomeHref('customer'),'/account'));
test('admin storefront Home stays /',()=>assert.equal(resolveStorefrontHomeHref('admin'),'/'));
test('admin app Home is /admin',()=>assert.equal(resolveHomeHref('admin'),'/admin'));
test('password recovery paths are not admin destinations',()=>{
  assert.equal(isPasswordRecoveryPath('/reset-password'),true);
  assert.equal(isPasswordRecoveryPath('/update-password'),true);
  assert.equal(resolvePostLoginPath('admin','/reset-password'),'/admin');
});
test('expired confirmation maps to branded login error',()=>{
  assert.equal(mapAuthProviderFailure({code:'otp_expired',message:'Token has expired or is invalid'}),'expired');
  assert.equal(mapAuthCallbackQueryError('access_denied','otp_expired'),'expired');
});
test('raw supabase login errors are not shown to customers',()=>{
  assert.match(publicAuthActionMessage('Invalid login credentials'),/email or password/i);
  assert.equal(publicAuthActionMessage('weird internal stack at GoTrueClient.ts:12').includes('GoTrue'), false);
});
console.log(`${n} auth redirect tests passed.`);
