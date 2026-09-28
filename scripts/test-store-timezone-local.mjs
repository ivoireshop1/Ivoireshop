import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: () => { throw new Error("no"); }, process: { env: {} } },
    { filename: file },
  );
  return exports;
}

const { storeGreetingAt, storeGreetingFromHour, hourInTimeZone } = load("src/lib/store/timezone.ts");
const tz = "America/New_York";
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log("PASS " + name);
}

test("hour helper maps 0-23", () => {
  for (let hour = 0; hour <= 23; hour++) {
    assert.equal(typeof storeGreetingFromHour(hour), "string");
  }
});

const cases = [
  ["2026-09-28T04:00:00.000Z", 0, "Good night"],
  ["2026-09-28T08:59:00.000Z", 4, "Good night"],
  ["2026-09-28T09:00:00.000Z", 5, "Good morning"],
  ["2026-09-28T15:59:00.000Z", 11, "Good morning"],
  ["2026-09-28T16:00:00.000Z", 12, "Good afternoon"],
  ["2026-09-28T20:59:00.000Z", 16, "Good afternoon"],
  ["2026-09-28T21:00:00.000Z", 17, "Good evening"],
  ["2026-09-29T01:59:00.000Z", 21, "Good evening"],
  ["2026-09-29T02:00:00.000Z", 22, "Good night"],
  ["2026-09-29T03:59:00.000Z", 23, "Good night"],
];

for (const [iso, hour, greeting] of cases) {
  test(`${hour}:00 store-local is ${greeting}`, () => {
    const date = new Date(iso);
    assert.equal(hourInTimeZone(date, tz), hour);
    assert.equal(storeGreetingAt(date, tz), greeting);
  });
}

test("UTC midnight is not used as the store hour", () => {
  const utcMidnight = new Date("2026-09-28T00:00:00.000Z");
  assert.notEqual(hourInTimeZone(utcMidnight, tz), 0);
  assert.notEqual(storeGreetingAt(utcMidnight, tz), "Good afternoon");
});

console.log(`${n} store timezone greeting tests passed`);
