/**
 * STAMP THE LIVE SHIFT ROW TERMINAL — the last act of a shift (issue #272).
 *
 * #272: *"At shift CLOSE it stamps the row terminal — shipped / stopped /
 * failed, with the PR number."*
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-close.mts \
 *     --outcome shipped --note 'PR #280 merged, edition 137 live' --pr 280
 *
 * `--id` is optional: with no id it closes the newest OPEN run, which is the
 * ordinary case. Pass one to close a DIFFERENT run — specifically a dead
 * shift's stale row, which `crew-shift-start.mts` prints when it finds one.
 *
 * # ⚠ THIS IS A WRITER, AND IT IS THE ONLY TABLE IT MAY NAME
 *
 * `crew_shift_runs` and nothing else; no DDL, no DELETE. A shift's road to the
 * founder's own half (`crew_replies`) is read-only by construction and stays
 * that way. `server/crewShiftWriterBoundary.test.ts` pins it at the source.
 *
 * # CLOSING IS AN UPDATE, NEVER A DELETE — THE ROW IS THE RECORD
 *
 * #272 asks for "the last three shifts" beside the running one, so a closed run
 * is the product rather than litter. The table has no purge path (migration
 * 0055) and one row per shift stays small.
 *
 * # A SHIFT THAT DIES NEVER REACHES THIS FILE, AND THAT IS HANDLED ELSEWHERE
 *
 * The stalled verdict is derived at read time from `heartbeatAt`
 * (`shared/crewShiftState.ts`), precisely because the case this script cannot
 * cover is the one that matters most. Nothing here needs to detect it.
 *
 * # ⚠ WHAT IT *DOES* DETECT: A SHIFT THAT NEVER CHECKED IN (issue #295)
 *
 * The heartbeat — `crew-shift-start.mts --note` — is deliberately manual, and
 * a manual control's whole risk is that nobody calls it. That is exactly what
 * happened: the mechanism was designed, documented in its own docblock, and had
 * **no caller anywhere** for as long as it existed, so `heartbeatAt` was
 * written once at open and never again — and his page called a working shift
 * dead while it was mid-merge.
 *
 * The standing orders now name the step, but `.agents/` is gitignored, so no
 * test in this repository can ever see whether that instruction is still there.
 * **This is therefore the only place the omission can be CAUGHT rather than
 * promised** — every shift passes through here, whatever else it does.
 *
 * So the close still succeeds and the row is still stamped; the script then
 * says the run never checked in and **exits 2**. Exit 2 is the finding, not a
 * failure — `crew-desk-sweep.mts` set that convention for the same reason, and
 * the message says so in as many words. Invariant 7 with the sign flipped: the
 * control sits on the path everything takes, so it cannot quietly stop
 * existing.
 */
import {
  CREW_SHIFT_OUTCOMES,
  CREW_SHIFT_STALL_MS,
  type CrewShiftOutcome,
  hasEverCheckedIn,
} from "../shared/crewShiftState.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";

const TABLE = "crew_shift_runs";

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) return null;
  return value;
}

/** UTC ISO, never a locale string — see `crew-shift-start.mts`'s note. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

/**
 * WHICH WORLD THIS ROW LANDS IN, NAMED PLAINLY.
 *
 * ⚠ This is the failure mode that matters most on this road, and it is silent.
 * The page #272 exists for is PRODUCTION; a shift that opens its row against
 * dev has done everything right, seen a success message, and left his page
 * saying "Nothing running" for the whole shift. Nothing anywhere would say so.
 *
 * The two worlds are the same hostname and the same database NAME and differ
 * only by PORT (`scripts/lib/dbConnection.mts`), so the port is not something
 * to make an operator read — the VARIABLE that answered is. `MYSQL_PUBLIC_URL`
 * is only present under `railway.cmd run --service MySQL`.
 */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

function refuse(message: string): never {
  console.error(`REFUSING: ${message}`);
  process.exit(1);
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  refuse("no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
}

const outcome = arg("outcome");
if (!outcome) refuse(`--outcome is required, one of: ${CREW_SHIFT_OUTCOMES.join(", ")}`);
if (!CREW_SHIFT_OUTCOMES.includes(outcome as CrewShiftOutcome)) {
  refuse(`--outcome "${outcome}" is not one of: ${CREW_SHIFT_OUTCOMES.join(", ")}`);
}

const explicitId = arg("id");
if (explicitId !== null && !/^\d+$/.test(explicitId)) refuse("--id must be a number.");
const prNumber = arg("pr");
if (prNumber !== null && !/^\d+$/.test(prNumber)) refuse("--pr must be a number.");

const conn = await openDatabase(url!);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  /* Working law 2 — the existence reader gets a control before its negative
     counts for anything. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    refuse("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    refuse(`\`${TABLE}\` does not exist in this world (migration 0055 — production takes it by ceremony).`);
  }

  /*
    WHICH ROW, decided and PRINTED before it is written. A close that reports
    success without naming what it closed is how a shift stamps somebody else's
    run and neither of them finds out.
  */
  /* ⚠ `heartbeatAt` is selected HERE and nowhere later: the UPDATE below sets
     it to now, which erases the one piece of evidence that the shift never
     checked in (`hasEverCheckedIn`'s docblock). Read after the write, every
     run in the table looks disciplined. */
  const [candidates] = await conn.query<any[]>(
    explicitId !== null
      ? `SELECT id, shift, seat, intent, startedAt, heartbeatAt, endedAt FROM \`${TABLE}\` WHERE id = ?`
      : `SELECT id, shift, seat, intent, startedAt, heartbeatAt, endedAt FROM \`${TABLE}\` WHERE endedAt IS NULL ORDER BY id DESC LIMIT 1`,
    explicitId !== null ? [Number(explicitId)] : [],
  );
  if (candidates.length !== 1) {
    refuse(
      explicitId !== null
        ? `no run #${explicitId}.`
        : "there is no open run to close. If this shift never opened one, that is the finding — say so in the report.",
    );
  }
  const target = candidates[0];
  if (target.endedAt !== null) {
    refuse(`run #${target.id} is already closed (${iso(target.endedAt)}). Closing it twice would rewrite the record.`);
  }
  console.log(`closing #${target.id}: ${target.shift} (${target.seat}) — ${target.intent}`);
  /* Snapshotted BEFORE the write, for the finding printed after it. */
  const checkedIn = hasEverCheckedIn({ startedAt: target.startedAt, heartbeatAt: target.heartbeatAt });
  const ranForMs = Date.now() - new Date(target.startedAt).getTime();

  const [result] = await conn.query<any>(
    `UPDATE \`${TABLE}\`
        SET endedAt = UTC_TIMESTAMP(),
            heartbeatAt = UTC_TIMESTAMP(),
            outcome = ?,
            outcomeNote = ?,
            prNumber = COALESCE(?, prNumber)
      WHERE id = ? AND endedAt IS NULL`,
    [outcome, arg("note")?.slice(0, 500) ?? null, prNumber === null ? null : Number(prNumber), target.id],
  );
  /* `endedAt IS NULL` in the WHERE makes this a compare-and-set: if another
     seat closed it between the read above and this write, nothing is
     overwritten and the count says so. */
  if (result.affectedRows !== 1) {
    refuse(`run #${target.id} was closed by somebody else between the read and the write. Nothing was overwritten.`);
  }

  const [rows] = await conn.query<any[]>(
    `SELECT id, shift, outcome, outcomeNote, prNumber, startedAt, endedAt FROM \`${TABLE}\` WHERE id = ?`,
    [target.id],
  );
  const row = rows[0];
  console.log(
    `\nCLOSED — run #${row.id} (${row.shift}): ${row.outcome}`
    + `${row.prNumber ? ` · PR #${row.prNumber}` : ""}\n  ${row.outcomeNote ?? "(no note)"}`
    + `\n  ${iso(row.startedAt)} → ${iso(row.endedAt)}`,
  );
  console.log("\nHis page now reads `Nothing running` unless another seat is open.");

  /*
    THE FINDING (#295). Reported only once the row is safely terminal — a
    check that can cost a shift its close is a check that gets skipped, and
    the record of what happened matters more than the discipline note.

    The bar is HALF the stall window and it DERIVES from that same constant
    rather than inventing a second number: a run past the FULL window with no
    check-in has already shown him the banner, so half is the early warning
    that arrives before it bites. A genuinely short shift — a quiet night, a
    one-line fix — has no meaningful step to stamp and is not a finding.
  */
  if (!checkedIn && ranForMs > CREW_SHIFT_STALL_MS / 2) {
    const minutes = Math.round(ranForMs / 60_000);
    console.error(
      `\n⚠ FINDING — run #${row.id} ran ${minutes} min and NEVER CHECKED IN.`
      + "\n  `heartbeatAt` still equals `startedAt`, so the heartbeat step in the standing"
      + "\n  orders was skipped for the whole shift. Past the window that reads as"
      + "\n  `no check-in` on his page, over a shift that was working — which is"
      + "\n  issue #295, recurring."
      + "\n"
      + "\n  The step, after every meaningful act (branch cut, PR opened, PR merged,"
      + "\n  edition written):"
      + "\n    railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-start.mts \\"
      + "\n      --note '<what just happened>' [--branch <name>]"
      + "\n"
      + "\n  The row IS closed and correct. Exit 2 is this finding, not a failure.",
    );
    await conn.end();
    process.exit(2);
  }
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
