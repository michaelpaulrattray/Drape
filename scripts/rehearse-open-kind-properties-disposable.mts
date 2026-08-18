/**
 * REHEARSAL — can the kind-property ceremony's shape check actually FAIL?
 *
 * One question, no callers, no importers (`scripts/README` discipline).
 *
 * The ceremony applied cleanly on the dev database twice and printed its green
 * lines. That is worth exactly nothing until the same assertions have been seen
 * to redden, because a checker that has only ever met a correct table is
 * indistinguishable from one that examines nothing (working law 2, and the
 * `accept-arm-inert-by-construction` habit).
 *
 * So this builds six throwaway tables in the DEV database, each wrong in one
 * way, and drives `assertKindPropertyShape` — the ceremony's own function, not a
 * copy of it — at each:
 *
 *   RIGHT         the real DDL, replayed under another name   must PASS
 *   NO KEY        every column, no unique index               must REFUSE
 *   NULLABLE      the key, and `locality` nullable            must REFUSE
 *   EXTRA         a column nobody designed                    must REFUSE
 *   BAD ENUM      anchorRegion missing a region and holding
 *                 an invented one                             must REFUSE
 *   BAD LOCALITY  the same, on the enum `locality` became
 *                 when it stopped being a boolean             must REFUSE
 *
 * **EACH ARM ASSERTS ITS OWN REFUSAL MESSAGE**, and that is not decoration. The
 * first run of this rehearsal after the anchor-region ruling showed all three
 * wrong tables refusing with `missing columns: anchorRegion` — they still carried
 * the old boolean — so the key check and the null check were not being exercised
 * at all while the summary line read REHEARSED. An arm that refuses for somebody
 * else's reason is an arm that has stopped testing anything, and only the message
 * tells them apart.
 *
 * The tables are named `zz_rehearse_okp_*` and dropped by NAME at the end — the
 * cleanup is scoped by the identifiers this script minted, never by a property
 * (the session-deletion lesson: nine rows deleted where two were meant).
 *
 * Dev only. It refuses to run against production, and it never touches the real
 * table.
 */
import "dotenv/config";

import { openDatabase } from "./lib/dbConnection.mts";
import { assertKindPropertyShape, OPEN_KIND_PROPERTY_TABLE } from "./lib/openKindPropertyShape.mts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("REFUSING: DATABASE_URL is not set in .env.");
  process.exit(1);
}
const parsed = new URL(url);
const where = `${parsed.hostname}:${parsed.port || "3306"}`;
if (process.env.MYSQL_PUBLIC_URL === url) {
  console.error("REFUSING: this URL is the production one — the rehearsal is dev only.");
  process.exit(1);
}
console.log(`world: DEV · ${where}`);

/* The names, minted here so the DROP can be scoped by exactly them. */
const MINTED = [
  "zz_rehearse_okp_right",
  "zz_rehearse_okp_nokey",
  "zz_rehearse_okp_nullable",
  "zz_rehearse_okp_extra",
  "zz_rehearse_okp_badenum",
  "zz_rehearse_okp_badlocality",
] as const;

const conn = await openDatabase(url);
const results: Array<{ arm: string; expected: "PASS" | "REFUSE"; got: string; verdict: string }> = [];
let failure: unknown;

try {
  /* The real DDL is the source for the RIGHT arm — read from the migration file
     so this rehearsal cannot certify a shape the migration does not produce. */
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile("drizzle/0033_casting_open_kind_properties.sql", "utf8");
  const statements = migration.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

  for (const table of MINTED) await conn.query(`DROP TABLE IF EXISTS \`${table}\``);

  /* RIGHT — the migration replayed verbatim under another name. */
  for (const statement of statements) {
    await conn.query(statement
      .replace(new RegExp(`\`${OPEN_KIND_PROPERTY_TABLE}\``, "g"), "`zz_rehearse_okp_right`")
      .replace(/`casting_open_kind_properties_id`/g, "`zz_rehearse_okp_right_id`")
      .replace(/`uq_casting_open_kind_properties_kind`/g, "`uq_zz_rehearse_okp_right_kind`"));
  }

  /* NO KEY — every column, and the bound simply not enforced. */
  await conn.query(`CREATE TABLE \`zz_rehearse_okp_nokey\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`kind\` varchar(64) NOT NULL,
    \`locality\` enum('single','coLocated','distributed') NOT NULL,
    \`anchorRegion\` enum('head','neck','torso','arms','hands','belowWaist','feet','wholeBody') NOT NULL,
    \`model\` varchar(128) NOT NULL,
    \`promptVersion\` varchar(32) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`))`);

  /* NULLABLE — the key is there and `locality` admits a null. */
  await conn.query(`CREATE TABLE \`zz_rehearse_okp_nullable\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`kind\` varchar(64) NOT NULL,
    \`locality\` enum('single','coLocated','distributed') NULL,
    \`anchorRegion\` enum('head','neck','torso','arms','hands','belowWaist','feet','wholeBody') NOT NULL,
    \`model\` varchar(128) NOT NULL,
    \`promptVersion\` varchar(32) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uq_zz_rehearse_okp_nullable_kind\` (\`kind\`))`);

  /* EXTRA — a column nobody designed, in the table whose short list is the point. */
  await conn.query(`CREATE TABLE \`zz_rehearse_okp_extra\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`kind\` varchar(64) NOT NULL,
    \`locality\` enum('single','coLocated','distributed') NOT NULL,
    \`anchorRegion\` enum('head','neck','torso','arms','hands','belowWaist','feet','wholeBody') NOT NULL,
    \`model\` varchar(128) NOT NULL,
    \`promptVersion\` varchar(32) NOT NULL,
    \`userId\` int NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uq_zz_rehearse_okp_extra_kind\` (\`kind\`))`);

  /* BAD ENUM — one region missing and one invented, so both directions of the
     set comparison are exercised by the same table. */
  await conn.query(`CREATE TABLE \`zz_rehearse_okp_badenum\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`kind\` varchar(64) NOT NULL,
    \`locality\` enum('single','coLocated','distributed') NOT NULL,
    \`anchorRegion\` enum('head','neck','torso','arms','hands','belowWaist','feet','elbows') NOT NULL,
    \`model\` varchar(128) NOT NULL,
    \`promptVersion\` varchar(32) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uq_zz_rehearse_okp_badenum_kind\` (\`kind\`))`);

  /* BAD LOCALITY — the enum check `locality` earned the moment it stopped being
     a boolean (fable-951). One member missing and one invented, same as above,
     so both directions of the set comparison are exercised here too. A column
     that can store `colocated` while the code spells it `coLocated` is a kind
     that never reaches the crop road and never reports why. */
  await conn.query(`CREATE TABLE \`zz_rehearse_okp_badlocality\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`kind\` varchar(64) NOT NULL,
    \`locality\` enum('single','colocated','paired') NOT NULL,
    \`anchorRegion\` enum('head','neck','torso','arms','hands','belowWaist','feet','wholeBody') NOT NULL,
    \`model\` varchar(128) NOT NULL,
    \`promptVersion\` varchar(32) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY(\`id\`),
    UNIQUE KEY \`uq_zz_rehearse_okp_badlocality_kind\` (\`kind\`))`);

  /* `because` is the arm's OWN reason, asserted. An arm refusing on somebody
     else's complaint has stopped testing its own — which is exactly what
     happened on this rehearsal's first run after the schema changed. */
  const arms: Array<{
    arm: string; table: string; key: string; expected: "PASS" | "REFUSE"; because?: string;
  }> = [
    { arm: "RIGHT", table: "zz_rehearse_okp_right", key: "uq_zz_rehearse_okp_right_kind", expected: "PASS" },
    {
      arm: "NO KEY",
      table: "zz_rehearse_okp_nokey",
      key: "uq_zz_rehearse_okp_nokey_kind",
      expected: "REFUSE",
      because: "one row per kind is not enforced",
    },
    {
      arm: "NULLABLE",
      table: "zz_rehearse_okp_nullable",
      key: "uq_zz_rehearse_okp_nullable_kind",
      expected: "REFUSE",
      because: "`locality` is nullable",
    },
    {
      arm: "EXTRA",
      table: "zz_rehearse_okp_extra",
      key: "uq_zz_rehearse_okp_extra_kind",
      expected: "REFUSE",
      because: "columns nobody designed: userId",
    },
    {
      arm: "BAD ENUM",
      table: "zz_rehearse_okp_badenum",
      key: "uq_zz_rehearse_okp_badenum_kind",
      expected: "REFUSE",
      because: "does not match BODY_ANCHOR_REGIONS",
    },
    {
      arm: "BAD LOCALITY",
      table: "zz_rehearse_okp_badlocality",
      key: "uq_zz_rehearse_okp_badlocality_kind",
      expected: "REFUSE",
      because: "does not match KIND_LOCALITIES",
    },
  ];

  for (const { arm, table, key, expected, because } of arms) {
    let got: string;
    try {
      await assertKindPropertyShape(conn, table, key);
      got = "PASS";
    } catch (cause) {
      got = `REFUSE — ${(cause as Error).message}`;
    }
    const rightKind = got.startsWith(expected);
    const rightReason = because === undefined || got.includes(because);
    const verdict = rightKind && rightReason
      ? "as expected"
      : rightKind
        ? `**WRONG REASON** — expected "${because}"`
        : "**WRONG**";
    results.push({ arm, expected, got, verdict });
  }
} catch (cause) {
  failure = cause;
} finally {
  /* Dropped by the names this script minted, one statement each. */
  for (const table of MINTED) {
    try {
      await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
    } catch (cause) {
      console.error(`cleanup failed for ${table}: ${(cause as Error).message}`);
    }
  }
}

for (const row of results) {
  console.log(`${row.arm.padEnd(10)} expected ${row.expected.padEnd(7)} → ${row.got}   [${row.verdict}]`);
}
console.log(`dropped: ${MINTED.join(", ")}`);

if (failure) {
  console.error(`FAILED: ${(failure as Error).message}`);
  await conn.end();
  process.exit(1);
}
const wrong = results.filter((row) => row.verdict !== "as expected");
await conn.end();
if (wrong.length > 0 || results.length !== MINTED.length) {
  console.error(`REHEARSAL FAILED: ${wrong.length} arm(s) did the wrong thing`);
  process.exit(1);
}
console.log("REHEARSED — the right table passes, and every wrong one refuses for its OWN reason.");
process.exit(0);
