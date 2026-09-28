import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>{throw Error('no')}},{filename:file});return exports;}
const {CANONICAL_CATEGORIES,canonicalSlugForName,isCanonicalSlug,categoriesForProductAssignment}=load('src/lib/catalog/canonical-categories.ts');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name)}
test('exactly three canonical names',()=>assert.equal(CANONICAL_CATEGORIES.map((c)=>c.name).join('|'),'Cosmetics|Foods|Ivoire Market'));
test('food aliases map to foods',()=>{for(const name of ['Food','foods','FOOD'])assert.equal(canonicalSlugForName(name),'foods')});
test('cosmetic aliases map to cosmetics',()=>{for(const name of ['Cosmetic','cosmetics','Beauty'])assert.equal(canonicalSlugForName(name),'cosmetics')});
test('ivoire market aliases',()=>assert.equal(canonicalSlugForName('Ivoire market','ivoire-market'),'ivoire-market'));
test('canonical slugs locked',()=>{assert.equal(isCanonicalSlug('foods'),true);assert.equal(isCanonicalSlug('rice-grains'),false)});
const sql=fs.readFileSync('supabase/migrations/20260928000000_canonical_storefront_categories.sql','utf8');
test('migration does not reactivate products',()=>assert.equal(/update public\.products\s+set[\s\S]{0,200}is_active\s*=\s*true/i.test(sql),false));
test('migration preserves category rows',()=>assert.equal(/delete from public\.categories/i.test(sql),false));
test('active-only product dropdown hides inactive legacy categories',()=>{
  const options=categoriesForProductAssignment([
    {id:'1',is_active:true,name:'Foods'},
    {id:'2',is_active:false,name:'African Foods'},
    {id:'3',is_active:false,name:'Beauty & Personal Care'},
  ]);
  assert.deepEqual(options.map((c)=>c.name),['Foods']);
});
test('current inactive assignment remains visible for existing product',()=>{
  const options=categoriesForProductAssignment([
    {id:'1',is_active:true,name:'Foods'},
    {id:'2',is_active:false,name:'African Foods'},
  ],'2');
  assert.equal(options.some((c)=>c.id==='2'),true);
});
test('assignment options sort canonical names',()=>{
  const options=categoriesForProductAssignment([
    {id:'3',is_active:true,name:'Ivoire Market'},
    {id:'1',is_active:true,name:'Foods'},
    {id:'2',is_active:true,name:'Cosmetics'},
  ]);
  assert.deepEqual(options.map((c)=>c.name),['Cosmetics','Foods','Ivoire Market']);
});
console.log(`${n} canonical category tests passed.`);
