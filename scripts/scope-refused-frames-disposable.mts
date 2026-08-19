/**
 * HOW BIG IS THE REFUSED-FRAMES POPULATION, AND HOW MUCH OF IT CAN STILL BE
 * LOOKED AT? (POST_SIGN_ROADMAP §4's remaining reading, scoped before it is
 * started.)
 *
 * The reading itself is by EYE — four buckets, against the reader's stated
 * reason, never by re-running the reader (working law 9). This script reads
 * nothing visual and decides nothing. It answers one question: **what is n**,
 * per world, so the court's arms are declared against a known population
 * instead of against whatever turns up. A by-eye classification begun on an
 * unknown n is how a half-read population reaches the next seat.
 *
 * Read-only: SELECTs against `casting_candidates` and
 * `casting_candidate_variants`. No writes, no credits, no vision, no R2.
 *
 * # The distinction that IS the scoping, and it is not a detail
 *
 * A refused render splits three ways and only one of them is readable:
 *
 *   FRAME SURVIVES     `failureClass` set AND `imageKey` present. A picture
 *                      exists and can be put in front of an eye. This is the
 *                      population.
 *   NO FRAME           `failureClass` set, `imageKey` NULL. Refused before a
 *                      picture existed, or the picture was never persisted.
 *                      Countable, unreadable, and it must be counted or the
 *                      rates are quoted against the wrong denominator.
 *   KEY BUT NO BYTES   a key that no longer resolves in R2. NOT distinguished
 *                      here on purpose — that costs a HEAD per row against a
 *                      bucket, and a key is the best claim available until the
 *                      reading actually opens one. Reported as a stated limit
 *                      rather than silently folded into "survives".
 *
 * # Controls (working law 2), because an empty result and a blind reader look
 * # identical
 *
 *   POSITIVE  the total row count of each table, unfiltered. A query that
 *             cannot see the table reports zero for that too, and the
 *             difference between the two numbers is the whole reading.
 *   NEGATIVE  the failureClass values actually present are PRINTED rather than
 *             filtered to the contract's three. If a class outside
 *             REFUSES_AFTER_RENDER appears against a refused row, the filter
 *             would be wrong and the print is what says so.
 *
 * The three-member set is restated in SQL rather than imported: importing it
 * would pull `server/providers/types.ts` into a process whose world is a
 * production URL, which is the mismatch `assertOneWorld` exists to prevent.
 * If the two ever disagree, the product's set is right.
 *
 *   npx tsx scripts/scope-refused-frames-disposable.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/scope-refused-frames-disposable.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";

import { openDatabase, worldOf } from "./lib/dbConnection.mts";
import { assertOneWorld } from "./lib/worldGuard.mts";

const KEY = process.env.MYSQL_PUBLIC_URL ? "MYSQL_PUBLIC_URL" : "DATABASE_URL";
assertOneWorld([KEY]);

const OUT = "output/refused-frames-scope";
mkdirSync(OUT, { recursive: true });

const lines: string[] = [];
const say = (line = "") => { console.log(line); lines.push(line); };

const url = process.env[KEY]!;
const connection = await openDatabase(url);

say("=".repeat(84));
say(`REFUSED-FRAMES SCOPE — ${worldOf(url)}  (via ${KEY})`);
say("=".repeat(84));

/* ---- the positive control: can this reader see the tables at all? -------- */

const [candidateTotal] = await connection.query<Array<{ n: number }>>(
  "SELECT COUNT(*) AS n FROM casting_candidates",
);
const [variantTotal] = await connection.query<Array<{ n: number }>>(
  "SELECT COUNT(*) AS n FROM casting_candidate_variants",
);
say("");
say("CONTROL — every row, unfiltered. A blind reader reports zero here too.");
say(`  casting_candidates          ${candidateTotal[0]?.n ?? "?"}`);
say(`  casting_candidate_variants  ${variantTotal[0]?.n ?? "?"}`);

/* ---- the negative control: every failure class present, unfiltered ------- */

const TABLES = ["casting_candidates", "casting_candidate_variants"] as const;

for (const table of TABLES) {
  const [classes] = await connection.query<Array<{
    failureClass: string | null; withFrame: number; withoutFrame: number;
  }>>(
    `SELECT failureClass,
            SUM(imageKey IS NOT NULL AND imageKey <> '') AS withFrame,
            SUM(imageKey IS NULL OR imageKey = '')       AS withoutFrame
       FROM ${table}
      WHERE failureClass IS NOT NULL
      GROUP BY failureClass
      ORDER BY COUNT(*) DESC`,
  );
  say("");
  say(`${table} — EVERY failure class present, not just the contract's three`);
  if (classes.length === 0) {
    say("  (none — no row in this table carries a failureClass)");
  } else {
    say("  class                        frame survives   no frame");
    for (const row of classes) {
      say(`  ${String(row.failureClass).padEnd(28)} ${String(row.withFrame).padStart(12)} ${String(row.withoutFrame).padStart(10)}`);
    }
  }
}

/* ---- the population, with its denominator beside it ---------------------- */

const READABLE = "failureClass IS NOT NULL AND imageKey IS NOT NULL AND imageKey <> ''";

for (const table of TABLES) {
  const [readable] = await connection.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE ${READABLE}`,
  );
  const [refused] = await connection.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM ${table} WHERE failureClass IS NOT NULL`,
  );
  const [span] = await connection.query<Array<{ first: Date | null; last: Date | null }>>(
    `SELECT MIN(createdAt) AS first, MAX(createdAt) AS last FROM ${table} WHERE ${READABLE}`,
  );
  say("");
  say(`${table} — THE POPULATION`);
  say(`  refused (any class)        ${refused[0]?.n ?? "?"}`);
  say(`  of those, frame survives   ${readable[0]?.n ?? "?"}`);
  say(`  first / last               ${span[0]?.first?.toISOString() ?? "—"} … ${span[0]?.last?.toISOString() ?? "—"}`);
}

/* ---- and whose they are, because a court on one account is a court on one
       account and should say so ---------------------------------------------- */

const [byUser] = await connection.query<Array<{ userId: number; n: number }>>(
  `SELECT userId, COUNT(*) AS n
     FROM casting_candidates
    WHERE ${READABLE}
    GROUP BY userId
    ORDER BY n DESC`,
);
say("");
say("candidates with a surviving frame, BY OWNER");
if (byUser.length === 0) say("  (none)");
for (const row of byUser) say(`  user ${String(row.userId).padStart(4)}   ${row.n}`);

/* ---- AND THE PLACE THE FRAMES ACTUALLY ARE ------------------------------
   The two queries above look at the candidate/variant row, which is where a
   naive reading of "the refunded render's frame" points. They return zero, and
   the zero is a fact about the WRITERS rather than about history:
   `failCandidate`/`failVariant` transition only out of `queued`/`dispatched`,
   and `imageKey` is written when a render SUCCEEDS. A refused row therefore
   never carries a frame and never could.

   The frames behind refusals live somewhere else entirely — `diagnosticCapture`
   puts them in the PRIVATE evidence bucket under its own key space, registered
   for deletion BEFORE the bytes are written. So the cleanup register is the
   index of the population, and it is the only index there is. */

const DIAGNOSTIC_PREFIX = "casting-v2/diagnostics";

const [diagnostics] = await connection.query<Array<{
  status: string; storageBackend: string; n: number; first: Date | null; last: Date | null;
}>>(
  `SELECT status, storageBackend, COUNT(*) AS n,
          MIN(createdAt) AS first, MAX(createdAt) AS last
     FROM storage_cleanup_items
    WHERE storageKey LIKE ?
    GROUP BY status, storageBackend
    ORDER BY n DESC`,
  [`${DIAGNOSTIC_PREFIX}/%`],
);
const [cleanupTotal] = await connection.query<Array<{ n: number }>>(
  "SELECT COUNT(*) AS n FROM storage_cleanup_items",
);
say("");
say("THE CAPTURED FRAMES — storage_cleanup_items under the diagnostics prefix");
say(`  CONTROL: every cleanup item, any key   ${cleanupTotal[0]?.n ?? "?"}`);
if (diagnostics.length === 0) {
  say(`  (no item whose key begins ${DIAGNOSTIC_PREFIX}/)`);
} else {
  for (const row of diagnostics) {
    say(`  ${row.status.padEnd(12)} ${row.storageBackend.padEnd(14)} ${String(row.n).padStart(5)}`
      + `   ${row.first?.toISOString() ?? "—"} … ${row.last?.toISOString() ?? "—"}`);
  }
}

/* One row per REFUSAL rather than per frame: a capture writes several frames
   under one operationId, and the unit a human reads is the refusal. */
const [operations] = await connection.query<Array<{ operationId: string; frames: number }>>(
  `SELECT SUBSTRING_INDEX(SUBSTRING(storageKey, ? ), '/', 1) AS operationId,
          COUNT(*) AS frames
     FROM storage_cleanup_items
    WHERE storageKey LIKE ?
    GROUP BY operationId
    ORDER BY frames DESC`,
  [DIAGNOSTIC_PREFIX.length + 2, `${DIAGNOSTIC_PREFIX}/%`],
);
say("");
say(`  distinct operations captured           ${operations.length}`);
if (operations.length > 0) {
  const frames = operations.reduce((sum, row) => sum + Number(row.frames), 0);
  say(`  frames across them                     ${frames}`);
  say("  (the first segment after the prefix is the USER, so these ids are");
  say("   user/operation pairs — printed raw rather than parsed, because a");
  say("   key shape guessed at is a wrong-boundary reading waiting to happen)");
  for (const row of operations.slice(0, 20)) {
    say(`    ${row.operationId}  ${row.frames}`);
  }
  if (operations.length > 20) say(`    … and ${operations.length - 20} more`);
}

say("");
say("=".repeat(84));
say("LIMIT, stated rather than folded in: `frame survives` means a KEY is on");
say("the row. Whether the object is still in R2 is not asked here — that is a");
say("HEAD per row against a bucket, and the reading itself will find out by");
say("opening them.");
say("=".repeat(84));

const stamp = worldOf(url).replace(/[^a-z0-9]+/gi, "-");
writeFileSync(`${OUT}/scope-${stamp}.txt`, lines.join("\n") + "\n");
say(`written: ${OUT}/scope-${stamp}.txt`);

process.exit(0);
