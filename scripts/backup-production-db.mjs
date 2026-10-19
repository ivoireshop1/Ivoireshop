/**
 * Free-plan Production logical backup (roles/schema/data).
 *
 * Usage (PowerShell):
 *   $env:PROD_DB_URL = "<session pooler URI with password>"
 *   node scripts/backup-production-db.mjs
 *
 * Never prints the connection string. Restore only to an isolated target.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PROD_REF = "lidqskyavlkzwerpncxa";
const outDir = path.resolve("backups/prod-rc4-prep");
const dbUrl = (process.env.PROD_DB_URL || process.env.SUPABASE_DB_URL || "").trim();

if (!dbUrl) {
  console.error("Missing PROD_DB_URL (or SUPABASE_DB_URL). Set it locally; do not commit it.");
  process.exit(1);
}
if (!dbUrl.includes(PROD_REF)) {
  console.error(`Refusing dump: connection must target Production ref ${PROD_REF}.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
console.log(`OUT_DIR=${outDir}`);
console.log(`TARGET_REF=${PROD_REF}`);
console.log(`STARTED_AT=${new Date().toISOString()}`);

const files = [
  { name: "roles.sql", args: ["--role-only"] },
  { name: "schema.sql", args: [] },
  { name: "data.sql", args: ["--use-copy", "--data-only"] },
];

for (const file of files) {
  const dest = path.join(outDir, file.name);
  console.log(`DUMP_START=${file.name}`);
  execFileSync(
    "npx",
    ["supabase", "db", "dump", "--db-url", dbUrl, "-f", dest, ...file.args],
    { stdio: ["ignore", "inherit", "inherit"], shell: true },
  );
  const buf = fs.readFileSync(dest);
  if (buf.length < 100) {
    console.error(`Dump incomplete: ${file.name}`);
    process.exit(1);
  }
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  console.log(`DUMP_OK=${file.name} bytes=${buf.length} sha256=${sha256}`);
}

console.log(`FINISHED_AT=${new Date().toISOString()}`);
console.log("Next: restore roles.sql+schema.sql+data.sql to an isolated DB only, then compare counts to Production.");
