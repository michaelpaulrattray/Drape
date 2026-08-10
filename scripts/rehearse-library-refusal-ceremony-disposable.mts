/**
 * REHEARSE THE 0029 CEREMONY before it is run against the live database.
 *
 * The live `casting_reference_library` already exists (0028 was applied on
 * 2026-08-10) and already holds rows. So the rehearsal database is put in
 * **exactly that shape** — journal replayed up to but NOT including 0029, then
 * a row inserted — and the real ceremony script is run against it.
 *
 * Four arms, because an additive migration has four ways to be wrong and only
 * the first one is obvious:
 *
 *   1. FIRST RUN     applies the columns, and the row that was already there
 *                    survives with NULL in every one of them (which is what
 *                    "this row is not a refusal" means)
 *   2. SECOND RUN    says ALREADY APPLIED and changes nothing — a ceremony that
 *                    cannot be re-run after a partial failure is one nobody can
 *                    recover from
 *   3. MISSING       one column dropped behind the ceremony's back: the
 *                    idempotency check sees its marker column and skips the
 *                    alter, so ONLY the read-back can catch this. It must.
 *   4. NOT NULL      a column applied in the wrong shape. A legal row is then
 *                    impossible to write and the failure would arrive on a paid
 *                    render, so the ceremony must refuse rather than nod along.
 *
 * Arms 3 and 4 are the controls: a read-back that only ever sees a correct
 * table cannot fail, and a checker that cannot fail is not a checker.
 *
 * It never touches the database named in DATABASE_URL, and refuses if that URL
 * did not come from `.env`.
 *
 *   npx tsx scripts/rehearse-library-refusal-ceremony-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const PREFIX = "drape_library_rehearsal_";
const HELD_BACK = "0029_casting_v2_library_refusals";
const REFUSED_COLUMNS = [
  "refusedContentKey",
  "refusedMaskKey",
  "refusedReason",
  "refusedKind",
  "refusedCoverage",
];

function databaseUrlFromDotEnv(): string | null {
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const active = process.env.DATABASE_URL!;
if (databaseUrlFromDotEnv() !== active) {
  throw new Error(
    "Refusing: DATABASE_URL was overridden rather than read from .env. This script creates and drops a database.",
  );
}
const url = new URL(active);
if (["prod", "production"].some((marker) => url.pathname.toLowerCase().includes(marker))) {
  throw new Error(`Refusing: database "${url.pathname}" looks like production`);
}

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) {
  throw new Error("generated an unsafe database name");
}

const server = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: false,
});

const rehearsalUrl = new URL(active);
rehearsalUrl.pathname = `/${databaseName}`;

const runCeremony = (label: string) => new Promise<number>((resolve) => {
  console.log(`\n── ${label}`);
  const child = spawn("npx", ["tsx", "scripts/ceremony-reference-library.mts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    /* The ceremony reads MYSQL_PUBLIC_URL and nothing else — the same variable
       name the real run will carry, pointed at the throwaway. */
    env: { ...process.env, MYSQL_PUBLIC_URL: rehearsalUrl.toString() },
  });
  child.on("exit", (code) => resolve(code ?? 1));
});

let exitCode = 1;
try {
  await server.query(`CREATE DATABASE \`${databaseName}\``);
  await server.changeUser({ database: databaseName });

  const files = (await readdir("drizzle"))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .filter((file) => !file.startsWith(HELD_BACK))
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await server.query(trimmed);
    }
  }

  /* THE LIVE SHAPE, asserted rather than assumed: the table is there (0028 was
     applied by hand on 2026-08-10) and the refused group is not. */
  const [tables] = await server.query<any[]>("SHOW TABLES LIKE 'casting_reference_library'");
  const [before] = await server.query<any[]>("SHOW COLUMNS FROM `casting_reference_library`");
  const beforeNames = before.map((column: any) => column.Field);
  if (tables.length !== 1 || REFUSED_COLUMNS.some((column) => beforeNames.includes(column))) {
    throw new Error("the rehearsal database is not in the live shape — table present, refused columns absent");
  }
  console.log(
    `[rehearsal] ${databaseName}: ${files.length} migration(s), ${HELD_BACK} HELD BACK`,
  );
  console.log(`[rehearsal] live shape confirmed — table present with ${beforeNames.length} columns, none of them refused*`);

  /* A ROW THAT WAS ALREADY THERE. The live table holds seven; an additive
     migration must leave them legal and unchanged, and the only way to know
     that is to have one and read it back afterwards. */
  const publicId = randomUUID();
  await server.execute(
    "INSERT INTO `casting_reference_library`"
    + " (publicId, userId, candidateId, variantId, role, slot, tier, noun, words, version)"
    + " VALUES (?, 1, 1, NULL, 'carry', 'lips', 'anatomy', 'lips', ?, 1)",
    [publicId, JSON.stringify(["full", "nude gloss"])],
  );

  /* ---------------------------------------------------- 1. the first run */

  if (await runCeremony("ARM 1 — FIRST RUN: applies 0029") !== 0) {
    throw new Error("the ceremony failed on its first run");
  }

  const [after] = await server.query<any[]>("SHOW COLUMNS FROM `casting_reference_library`");
  const nullable = new Map(after.map((column: any) => [column.Field, column.Null === "YES"]));
  for (const column of REFUSED_COLUMNS) {
    if (!nullable.has(column)) throw new Error(`${column} is absent after the ceremony ran`);
    if (nullable.get(column) !== true) throw new Error(`${column} came out NOT NULL`);
  }
  const [survivor] = await server.query<any[]>(
    "SELECT * FROM `casting_reference_library` WHERE publicId = ?",
    [publicId],
  );
  if (survivor.length !== 1) throw new Error("the row that was already there did not survive the alter");
  for (const column of REFUSED_COLUMNS) {
    if (survivor[0][column] !== null) {
      throw new Error(`the surviving row has ${column} = ${survivor[0][column]}, and it must be NULL`);
    }
  }
  if (survivor[0].slot !== "lips" || survivor[0].version !== 1) {
    throw new Error("the surviving row's own columns changed under the alter");
  }
  console.log("\n[rehearsal] ARM 1 PASSED — five nullable columns, the existing row intact and NULL in all of them");

  /* --------------------------------------------------- 2. the second run */

  if (await runCeremony("ARM 2 — SECOND RUN: must say ALREADY APPLIED") !== 0) {
    throw new Error("the ceremony failed on its second run — it is not re-runnable");
  }
  const [twice] = await server.query<any[]>("SHOW COLUMNS FROM `casting_reference_library`");
  if (twice.length !== after.length) {
    throw new Error(`the second run changed the column count: ${after.length} → ${twice.length}`);
  }
  console.log(`\n[rehearsal] ARM 2 PASSED — ${twice.length} columns after two runs, unchanged`);

  /* ------------------------------- 3. a column missing behind its marker */

  /*
    `refusedMaskKey` dropped, `refusedContentKey` left in place. The ceremony's
    idempotency check reads the marker column, sees it, and skips the alter — so
    if the read-back is doing nothing, this arm passes and the database is left
    one column short of the writer's INSERT.
  */
  await server.query("ALTER TABLE `casting_reference_library` DROP COLUMN `refusedMaskKey`");
  if (await runCeremony("ARM 3 — CONTROL: refusedMaskKey dropped, must FAIL") === 0) {
    throw new Error("the ceremony passed with a column missing — the read-back is not reading");
  }
  console.log("\n[rehearsal] ARM 3 PASSED — the ceremony refused a table missing one column");

  /* ------------------------------------------ 4. a column in the wrong shape */

  await server.query("ALTER TABLE `casting_reference_library` ADD COLUMN `refusedMaskKey` varchar(512)");
  /* MySQL will not narrow a column to NOT NULL while a NULL sits in it — which
     is itself the reason this arm matters: the wrong shape is only reachable on
     a table whose rows were emptied of the meaning the column carries. */
  await server.query("UPDATE `casting_reference_library` SET `refusedReason` = ''");
  await server.query(
    "ALTER TABLE `casting_reference_library` MODIFY COLUMN `refusedReason` varchar(32) NOT NULL DEFAULT ''",
  );
  if (await runCeremony("ARM 4 — CONTROL: refusedReason NOT NULL, must FAIL") === 0) {
    throw new Error("the ceremony passed a NOT NULL refusedReason — the nullability check is not checking");
  }
  console.log("\n[rehearsal] ARM 4 PASSED — the ceremony refused a column applied in the wrong shape");

  console.log("\n[rehearsal] REHEARSED CLEAN — applies, re-runs, and fails both ways it must.");
  exitCode = 0;
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[rehearsal] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
