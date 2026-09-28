import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/demo-images.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports },
  { filename: "src/lib/demo-images.ts" },
);

const hero = exports.demoImages.heroCustomer;
assert.equal(hero, "/demo/hero-customer.png");
assert.equal(hero.endsWith(".svg"), false);

const file = "public" + hero;
assert.equal(fs.existsSync(file), true);
const bytes = fs.statSync(file).size;
assert.ok(bytes > 100_000, "photographic hero must be a real image, not a stub");

const png = fs.readFileSync(file);
assert.equal(png[0], 0x89);
assert.equal(png[1], 0x50);
assert.equal(png[2], 0x4e);
assert.equal(png[3], 0x47);

console.log("PASS guest photographic hero asset is present and not an SVG");
