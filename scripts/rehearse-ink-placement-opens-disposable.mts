/**
 * REHEARSE THE PLACEMENT-OPENS CEREMONY before the founder runs it (0046).
 *
 * Creates a throwaway database on the dev server, replays the journal up to BUT
 * NOT INCLUDING 0046 — so the rehearsal database is in exactly the shape the
 * founder's world will be in — then runs the real ceremony against it, twice.
 *
 * Twice, because the second run is the half that matters: a ceremony that
 * cannot be re-run after a partial failure is a ceremony nobody can recover
 * from at 3am, and "ALREADY APPLIED" has to be a real branch rather than a
 * hopeful comment.
 *
 * # THE ARM ASSERTS ITS OWN REASON
 *
 * The pre-state is CHECKED rather than assumed: both columns must be `enum(…)`
 * before the ceremony runs. A rehearsal that started from a database where they
 * were already `varchar` would pass without the ceremony applying anything —
 * the shape of failure this program has already paid for, where five arms all
 * refused for a reason nobody read and the summary said REHEARSED.
 *
 * # AND IT PLANTS ROWS, BECAUSE "LOSSLESS" IS A CLAIM ABOUT MySQL
 *
 * enum → varchar preserves stored strings *in the manual*, and the manual is
 * not this database. Unlike 0039 — which added a column to rows that had no
 * opinion about it — this ALTER rewrites a column that HOLDS HIS DATA. So rows
 * are written before the ALTER and read back after it, by value, and the
 * rehearsal fails if a single character moved. That is the difference between
 * a rehearsal of the ceremony and a rehearsal of the ceremony's risk.
 *
 * It never touches the database named in DATABASE_URL, and refuses if that URL
 * did not come from `.env` or looks like production.
 *
 *   npx tsx scripts/rehearse-ink-placement-opens-disposable.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { openServer } from "./lib/serverConnection.mts";

const PREFIX = "drape_ink_placement_rehearsal_";
const HELD_BACK = "0046_ink_placement_opens";
const COLUMN = "placement";
const TABLES = ["casting_ink_designs", "casting_ink_form_demand"] as const;

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
  throw new Error("Refusing: DATABASE_URL was overridden rather than read from .env. This script creates and drops a database.");
}
const url = new URL(active);
if (["prod", "production"].some((marker) => url.pathname.toLowerCase().includes(marker))) {
  throw new Error(`Refusing: database "${url.pathname}" looks like production`);
}

const databaseName = `${PREFIX}${Math.random().toString(36).slice(2, 10)}`;
if (!new RegExp(`^${PREFIX}[a-z0-9]+$`).test(databaseName)) throw new Error("generated an unsafe database name");

const server = await openServer(url, { multipleStatements: false });
const rehearsalUrl = new URL(active);
rehearsalUrl.pathname = `/${databaseName}`;

/*
  The words planted before the ALTER. All three measured members, because the
  question is whether the EXISTING contents survive — an open word cannot be
  planted first, the enum would refuse it, which is the whole reason for 0046.
*/
const PLANTED = ["neck", "upperArm", "upperChest"] as const;

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
  console.log(`[rehearsal] ${databaseName}: ${files.length} migration(s), ${HELD_BACK} HELD BACK\n`);

  /* The pre-state, asserted on BOTH tables. Each must be here (or the
     ceremony's own refusal is what would be under test rather than the apply),
     and each must still be an ENUM. */
  for (const table of TABLES) {
    const [tables] = await server.query<any[]>(`SHOW TABLES LIKE '${table}'`);
    if (tables.length !== 1) throw new Error(`\`${table}\` is missing — the journal replay did not build the world`);
    const [before] = await server.query<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE '${COLUMN}'`);
    if (before.length !== 1) throw new Error(`\`${table}\`.\`${COLUMN}\` is missing before the ceremony`);
    if (!/^enum\(/i.test(String(before[0].Type))) {
      throw new Error(
        `\`${table}\`.\`${COLUMN}\` is already ${before[0].Type} — the hold-back did not hold, `
        + "and this rehearsal would pass without applying anything",
      );
    }
  }
  console.log(`[rehearsal] confirmed: both \`${COLUMN}\` columns are still enums — the founder's shape\n`);

  /*
    THE ROWS THAT MAKE "LOSSLESS" A READING.

    `casting_ink_form_demand` is the honest one to plant into: its columns are
    all scalars with no owner and no bytes behind them, so a planted row is a
    complete row rather than a fixture pretending to be one. The design table
    would need a candidate, a user, a storage key and a digest to be plantable
    at all, and a row assembled to satisfy NOT NULLs tests the assembly rather
    than the ALTER.

    So: the demand table carries the value reading, and the design table carries
    the COUNT reading in the ceremony itself. Both columns get the same ALTER;
    what differs is only which evidence each one can honestly produce.
  */
  for (const placement of PLANTED) {
    await server.query(
      "INSERT INTO `casting_ink_form_demand` (`kind`, `placement`, `outcome`) VALUES (?, ?, ?)",
      ["torsoUnstated", placement, "refused"],
    );
  }
  console.log(`[rehearsal] planted ${PLANTED.length} demand row(s): ${PLANTED.join(", ")}\n`);

  const run = (label: string) => new Promise<number>((resolve) => {
    console.log(`── ${label}`);
    /* `--production` deliberately: that is the arm the founder will run, and it
       is the one carrying the extra guards (no dotenv, MYSQL_PUBLIC_URL only, a
       refusal when the two URLs are the same string). Rehearsing `--dev` would
       leave all three untested on the night. */
    const child = spawn("npx", ["tsx", "scripts/ceremony-ink-placement-opens.mts", "--production"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, MYSQL_PUBLIC_URL: rehearsalUrl.toString() },
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });

  const first = await run("FIRST RUN — applies 0046");
  if (first !== 0) throw new Error("the ceremony failed on its first run");
  const second = await run("\nSECOND RUN — must say ALREADY APPLIED and change nothing");
  if (second !== 0) throw new Error("the ceremony failed on its second run — it is not re-runnable");

  console.log("");
  for (const table of TABLES) {
    const [after] = await server.query<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE '${COLUMN}'`);
    if (after.length !== 1) throw new Error(`after two runs \`${table}\`.\`${COLUMN}\` is present ${after.length} time(s), not exactly once`);
    if (!/^varchar\(64\)$/i.test(String(after[0].Type))) throw new Error(`\`${table}\`.\`${COLUMN}\` is ${after[0].Type}, not varchar(64)`);
    if (String(after[0].Null).toUpperCase() !== "NO") throw new Error(`\`${table}\`.\`${COLUMN}\` became NULLABLE — a MODIFY restates the whole column`);
    console.log(`[rehearsal] ${table.padEnd(25)} ${after[0].Type} NOT NULL`);
  }

  /* The planted values, read back by value and in order. */
  const [survivors] = await server.query<any[]>(
    "SELECT `placement` FROM `casting_ink_form_demand` ORDER BY `id`",
  );
  const readBack = survivors.map((row) => String(row.placement));
  if (readBack.length !== PLANTED.length || readBack.some((value, index) => value !== PLANTED[index])) {
    throw new Error(
      `the ALTER moved the data: planted [${PLANTED.join(", ")}], read back [${readBack.join(", ")}]`,
    );
  }
  console.log(`[rehearsal] the ${PLANTED.length} planted words survived the ALTER byte for byte: ${readBack.join(", ")}`);

  /* AND THE POINT OF THE WHOLE MIGRATION, proven rather than assumed: a word
     the vocabulary never measured is now storable. Before the ALTER this
     statement errors under STRICT_TRANS_TABLES; if it errors after, the
     migration achieved nothing and every arm above would still be green. */
  await server.query(
    "INSERT INTO `casting_ink_form_demand` (`kind`, `placement`, `outcome`) VALUES (?, ?, ?)",
    ["torsoUnstated", "sleeve", "refused"],
  );
  const [open] = await server.query<any[]>(
    "SELECT `placement` FROM `casting_ink_form_demand` WHERE `placement` = 'sleeve'",
  );
  if (open.length !== 1) throw new Error("`sleeve` did not survive its own insert — the column is still a fence");
  console.log("[rehearsal] and `sleeve` — a word the vocabulary never measured — was accepted and read back");

  console.log(`\n[rehearsal] REHEARSED CLEAN — both columns varchar(64) NOT NULL after two runs, data intact, open word accepted.`);
  exitCode = 0;
} finally {
  await server.changeUser({ database: undefined as never }).catch(() => undefined);
  await server.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  console.log(`[rehearsal] dropped ${databaseName}`);
  await server.end();
}

process.exit(exitCode);
