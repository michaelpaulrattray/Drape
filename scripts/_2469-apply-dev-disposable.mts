/**
 * #2469 — create `cast_voices` on the DEV database so the voice road can be
 * driven against real rows. Dev-side additive migrations are pre-authorised
 * (CLAUDE.local.md).
 *
 * ⚠ **ONLY THIS CARD'S OWN MIGRATION IS APPLIED, AND THAT IS DELIBERATE.**
 * Running the rite's `autoApplyMigrations` here would have applied everything
 * the dev database happens to lack — a `--dry` run showed it also wants
 * `drizzle/0071`'s `free_grant_claims` and `face_scan_daily_usage`, which are
 * pre-existing dev drift and no business of this card. So the statements are
 * taken from this card's file alone, and the rite's own classifier is what
 * approves them: `_2469-classify-migration-disposable.mts` reads all three as
 * ADDITIVE with a destructive control beside it, which is the claim that
 * matters for production (the pre-deploy applier will apply them unattended and
 * no ceremony reaches the founder).
 *
 *   npx tsx scripts/_2469-apply-dev-disposable.mts --dry
 *   npx tsx scripts/_2469-apply-dev-disposable.mts
 */
import { readFileSync } from "node:fs";

import "dotenv/config";
import { statementsFrom } from "./lib/ceremonyAutoApply.mts";
import { getDb } from "../server/db/connection";
import { assertOneWorld } from "./lib/worldGuard.mts";

assertOneWorld(["DATABASE_URL"]);

const dry = process.argv.includes("--dry");
const file = "drizzle/0083_cast_voices.sql";

const db = await getDb();
if (!db) throw new Error("no database");
const client = (db as unknown as {
  session: { client: { query: (sql: string) => Promise<[unknown[], unknown]> } };
}).session.client;

const statements = statementsFrom([{ name: file, sql: readFileSync(file, "utf8") }]);

/* REFUSE rather than apply anything this card's file did not declare additive. */
const destructive = statements.filter((statement) => statement.kind !== "additive");
if (destructive.length > 0) {
  console.error(`REFUSED — ${destructive.length} statement(s) are not additive`);
  for (const statement of destructive) console.error(`  ${statement.reason}`);
  process.exit(1);
}

const [before] = await client.query(
  "select table_name from information_schema.tables where table_schema = database() and table_name = 'cast_voices'",
);
console.log(`cast_voices before: ${(before as unknown[]).length > 0 ? "EXISTS" : "absent"}`);

for (const statement of statements) {
  const head = statement.sql.replace(/\s+/g, " ").slice(0, 70);
  if (dry) {
    console.log(`  would apply: ${head}`);
    continue;
  }
  await client.query(statement.sql);
  console.log(`  applied: ${head}`);
}

/* THE READ-BACK — the artifact, not the absence of an error (working law 1). */
const [after] = await client.query(
  "select table_name from information_schema.tables where table_schema = database() and table_name = 'cast_voices'",
);
const [columns] = await client.query(
  "select column_name as n, column_type as t, is_nullable as nullable from information_schema.columns " +
    "where table_schema = database() and table_name = 'cast_voices' order by ordinal_position",
);
const [indexes] = await client.query(
  "select distinct index_name as n from information_schema.statistics " +
    "where table_schema = database() and table_name = 'cast_voices'",
);

console.log(`\ncast_voices after: ${(after as unknown[]).length > 0 ? "EXISTS" : "absent"}`);
for (const column of columns as Array<Record<string, unknown>>) {
  console.log(
    `  ${String(column.n).padEnd(16)} ${String(column.t).padEnd(14)} ` +
      `${column.nullable === "YES" ? "NULL" : "NOT NULL"}`,
  );
}
console.log("  indexes:", (indexes as Array<Record<string, unknown>>).map((row) => row.n).join(", "));

process.exit(0);
