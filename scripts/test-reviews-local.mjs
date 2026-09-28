import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let rpcError = null;
let rpcPayload = null;
let user = { id: "u1" };
const logs = [];

const supabase = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async (name, payload) => {
    rpcPayload = { name, payload };
    return { error: rpcError };
  },
  from() {
    return {
      delete() { return this; },
      eq() { return this; },
      then(resolve) { return Promise.resolve({ error: rpcError }).then(resolve); },
    };
  },
};

function load(file) {
  const exports = {};
  const require = (id) => {
    if (id === "@/src/lib/supabase/server") return { createClient: async () => supabase };
    if (id === "next/cache") return { revalidatePath() {} };
    if (id === "next/navigation") return { unstable_rethrow() {} };
    if (id.startsWith("@/")) return load(id.replace(/^@\//, "") + ".ts");
    throw new Error(id);
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require, console: { log: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")) } },
    { filename: file },
  );
  return exports;
}

const { saveProductReview } = load("src/lib/reviews/actions.ts");
const { reviewActionMessage } = load("src/lib/reviews/errors.ts");
const { isPublicReviewStatus, REVIEW_SUBMITTED_MESSAGE, starDisplay } = load("src/lib/reviews/public.ts");

function form(overrides = {}) {
  const data = new FormData();
  data.set("product_id", "11111111-1111-4111-8111-111111111111");
  data.set("product_slug", "shea-butter");
  data.set("rating", "5");
  data.set("review_title", "Great");
  data.set("review_text", "Works well");
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

let n = 0;
async function test(name, fn) {
  rpcError = null;
  rpcPayload = null;
  user = { id: "u1" };
  logs.length = 0;
  await fn();
  n++;
  console.log("PASS " + name);
}

await test("valid submit does not throw and calls the review rpc", async () => {
  const result = await saveProductReview({ error: null, success: false }, form());
  assert.equal(result.success, true);
  assert.equal(result.error, null);
  assert.equal(rpcPayload.name, "submit_product_review");
  assert.equal(rpcPayload.payload.p_rating, 5);
});

await test("validation errors stay inline", async () => {
  const result = await saveProductReview({ error: null, success: false }, form({ rating: "0" }));
  assert.equal(result.success, false);
  assert.equal(result.error, "Choose a rating from 1 to 5.");
  assert.equal(rpcPayload, null);
});

await test("database errors stay inline", async () => {
  rpcError = { code: "22023", message: "Rating must be between 1 and 5." };
  const result = await saveProductReview({ error: null, success: false }, form());
  assert.equal(result.success, false);
  assert.match(result.error, /rating/i);
});

await test("pending is the public default and published-only is public", () => {
  assert.equal(isPublicReviewStatus("pending"), false);
  assert.equal(isPublicReviewStatus("hidden"), false);
  assert.equal(isPublicReviewStatus("published"), true);
  assert.equal(REVIEW_SUBMITTED_MESSAGE, "Thank you. Your review was submitted for approval.");
});

await test("star rendering never uses a negative repeat count", () => {
  const none = starDisplay(null);
  const max = starDisplay(9);
  assert.equal(none.filled, 0);
  assert.equal(none.empty, 5);
  assert.equal(max.filled, 5);
  assert.equal(max.empty, 0);
});

await test("rpc mapping hides privilege noise", () => {
  assert.equal(reviewActionMessage({ code: "42P17", message: "infinite recursion detected in policy" }).includes("recursion"), false);
});

const sql = fs.readFileSync("supabase/migrations/20260928070000_review_submit_safety.sql", "utf8");
const grantSql = fs.readFileSync("supabase/migrations/20260928072000_review_admin_update.sql", "utf8");
await test("submit rpc writes pending reviews", () => {
  assert.match(sql, /status = 'pending'|status\)[\s\S]*'pending'/);
  assert.match(sql, /p_review_title/);
});

await test("admin update grant does not add a customer insert path", () => {
  assert.match(grantSql, /grant update on table public\.product_reviews to authenticated/i);
  assert.doesNotMatch(grantSql, /grant insert/i);
});

await test("review action module does not export a plain object", () => {
  const source = fs.readFileSync("src/lib/reviews/actions.ts", "utf8");
  assert.equal(/^export const /m.test(source), false);
  assert.match(fs.readFileSync("src/lib/reviews/public.ts", "utf8"), /initialReviewActionState/);
});

console.log(`${n} review tests passed.`);
