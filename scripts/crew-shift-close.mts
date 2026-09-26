/**
 * STAMP THE LIVE SHIFT ROW TERMINAL — the last act of a shift (issue #272).
 *
 * #272: *"At shift CLOSE it stamps the row terminal — shipped / stopped /
 * failed, with the PR number."*
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-close.mts \
 *     --outcome shipped --note 'PR #280 merged, edition 137 live' --pr 280
 *
 * `--shift <id>` names YOUR OWN row — the same id you opened with. With nothing
 * named it closes the one open run, and **REFUSES when more than one is open**
 * rather than guessing. `--id <n>` closes a row by number, which is the dead
 * shift's stale row `crew-shift-start.mts` prints when it finds one.
 *
 * ⚠ **IT USED TO CLOSE THE NEWEST OPEN RUN WITH NOTHING NAMED, AND THAT CLOSED
 * SOMEBODY ELSE'S ROW (#1234).** Measured 2026-09-25: row #360 was open from
 * 06:50Z, a second seat opened #361 at 07:45Z, and at 07:55Z the first shift's
 * bare close stamped **#361** with the first shift's note while that seat was
 * mid-shift on a `founder-ordered` card. The existing live-row guard cannot
 * catch it — a live seat that is simply building looks identical to a dead one —
 * so the DEFAULT was removed rather than documented harder. The decision is
 * `resolveCloseTarget` in `shared/crewShiftState.ts`, driven directly.
 *
 * `--dry-run` performs no write and prints exactly what the close would set.
 * `--force` is required to close a row that has checked in within the last
 * couple of minutes. **To simply LOOK at what is running, do not come here at
 * all** — `scripts/crew-shift-state.mts` is the reader, and it cannot write.
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
 *
 * # ⚠ THREE GUARDS THIS SCRIPT DID NOT HAVE, AND THE INCIDENT THAT BOUGHT THEM
 *
 * Issue #288, 2026-08-30, on PRODUCTION. An operator wanting to READ the live
 * row typed `--outcome shipped --note probe --dry-run`. There was no
 * `--dry-run`; the word was ignored and the close was performed, stamping a
 * RUNNING shift's row terminal so his page read *"Nothing running"* mid-shift.
 *
 *   1. **Unknown arguments are refused** (`scripts/lib/strictArgs.mts`). A
 *      production writer must refuse what it does not understand.
 *   2. **`--dry-run` exists and is real** — it resolves the target, prints every
 *      field the UPDATE would set, and writes nothing.
 *   3. **A row that looks LIVE is refused without `--force`** — `looksLive`,
 *      `shared/crewShiftState.ts`, which owns the bar and the argument for it.
 *
 * The deeper cause was the second defect on that card and it is fixed
 * elsewhere: **there was no read command at all**, so an operator reaching to
 * look had nothing but a writer to reach for. That is
 * `scripts/crew-shift-state.mts`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CREW_SHIFT_OUTCOMES,
  CREW_SHIFT_STALL_MS,
  type CrewShiftOutcome,
  hasEverCheckedIn,
  looksLive,
  resolveCloseTarget,
} from "../shared/crewShiftState.js";
import {
  deskItemsWaitingOnHim,
  waitingOnHimFinding,
  type ResolvableBriefing,
} from "../shared/crewCardResolution.js";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { refreshQueueCountsQuietly } from "./lib/crewQueueCount.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const TABLE = "crew_shift_runs";

/**
 * The deployed briefing — his Desk, as this tree ships it.
 *
 * Read for ONE question (#1349): is the card this run names still waiting on his
 * eye or on an answer from him? It is read from the repository rather than from
 * the page, because a close runs where the code is and the page is a render of
 * this same file.
 */
const BRIEFING_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "server",
  "crew",
  "crew-briefing.json",
);

/**
 * His desk, or `null` when it cannot be read.
 *
 * ⚠ NULL IS NOT "NOTHING IS WAITING", and the caller says so out loud rather
 * than printing a clean bill. A close must never die on a reading — losing a
 * shift's close leaves a row open, which his page renders as a shift still
 * running (#288) — so this swallows, and the honesty is in what gets printed.
 */
function readDeskOrNull(): ResolvableBriefing | null {
  try {
    return JSON.parse(readFileSync(BRIEFING_PATH, "utf8")) as ResolvableBriefing;
  } catch {
    return null;
  }
}

/** `#1349` → 1349; anything else → null, because a guess is worse than a skip. */
function issueNumberOf(cardRef: unknown): number | null {
  const match = /^#(\d+)$/.exec(String(cardRef ?? "").trim());
  return match ? Number(match[1]) : null;
}

/* ⚠ EVERY ARGUMENT ENUMERATED — anything else refuses (#288). A flag added to
   this script and not to this list is refused, which is the correct direction:
   the failure is loud and one line from fixed, where the old reader's failure
   was silent and wrote to production. */
const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["outcome", "note", "pr", "id", "shift"],
  boolean: ["dry-run", "force"],
});

function arg(name: string): string | null {
  return ARGS.value(name);
}

const DRY_RUN = ARGS.flag("dry-run");
const FORCE = ARGS.flag("force");

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
  /* ⚠ #1234 — the no-id read is EVERY open run now, not `LIMIT 1`. The one-row
     read could not tell a single-seat night from two seats overlapping, so the
     decision it fed had no way to refuse. `resolveCloseTarget` owns the choice
     and is driven without a database. */
  const [candidates] = await conn.query<any[]>(
    explicitId !== null
      ? `SELECT id, shift, seat, cardRef, intent, startedAt, heartbeatAt, endedAt FROM \`${TABLE}\` WHERE id = ?`
      : `SELECT id, shift, seat, cardRef, intent, startedAt, heartbeatAt, endedAt FROM \`${TABLE}\` WHERE endedAt IS NULL ORDER BY id DESC`,
    explicitId !== null ? [Number(explicitId)] : [],
  );

  let target: any;
  if (explicitId !== null) {
    if (candidates.length !== 1) refuse(`no run #${explicitId}.`);
    target = candidates[0];
  } else {
    const verdict = resolveCloseTarget({
      openRuns: candidates.map((row) => ({
        id: Number(row.id),
        shift: String(row.shift),
        seat: String(row.seat),
        intent: String(row.intent),
      })),
      shift: arg("shift"),
    });
    if (verdict.kind === "refuse") refuse(verdict.why);
    console.log(`target: run #${verdict.run.id}, chosen by ${verdict.how}`);
    target = candidates.find((row) => Number(row.id) === verdict.run.id)!;
  }
  if (target.endedAt !== null) {
    refuse(`run #${target.id} is already closed (${iso(target.endedAt)}). Closing it twice would rewrite the record.`);
  }
  console.log(`closing #${target.id}: ${target.shift} (${target.seat}) — ${target.intent}`);
  /* Snapshotted BEFORE the write, for the finding printed after it. */
  const checkedIn = hasEverCheckedIn({ startedAt: target.startedAt, heartbeatAt: target.heartbeatAt });
  const ranForMs = Date.now() - new Date(target.startedAt).getTime();

  /*
    ⚠ IS SOMEBODY MID-ACT ON THIS ROW? (#288)

    The incident closed a row that had checked in minutes earlier. `looksLive`
    owns the bar and the whole argument for it; what belongs here is the
    RECOVERY, because a refusal an operator cannot get past is a refusal they
    learn to route around. It is one word, and the word is printed.

    ⚠ It is checked BEFORE the dry-run report deliberately: a `--dry-run` on a
    live row should say "I would refuse this", not describe a write that would
    not happen. A dry run that reports a different verdict from the real one is
    worse than no dry run.
  */
  if (!FORCE && looksLive({ startedAt: target.startedAt, heartbeatAt: target.heartbeatAt }, Date.now())) {
    const secondsAgo = Math.round((Date.now() - new Date(target.heartbeatAt).getTime()) / 1000);
    refuse(
      `run #${target.id} (${target.shift}) checked in ${secondsAgo}s ago — it looks LIVE, and closing a`
      + " running shift's row is what issue #288 is about: his page reads `Nothing running` while a shift"
      + " runs.\n  If you meant to LOOK at it:   npx tsx scripts/crew-shift-state.mts"
      + `\n  If you really mean to close it: add --force${explicitId === null ? ` --id ${target.id}` : ""}`,
    );
  }

  /*
    THE DRY RUN (#288). Every field the UPDATE below would set, printed from the
    same values it would use — not a paraphrase. Nothing is written.
  */
  if (DRY_RUN) {
    console.log(
      `\nDRY RUN — nothing written. The close would set, on run #${target.id}:`
      + `\n  outcome     ${outcome}`
      + `\n  outcomeNote ${arg("note")?.slice(0, 500) ?? "(unchanged — none given)"}`
      + `\n  prNumber    ${prNumber === null ? "(unchanged — none given)" : `#${prNumber}`}`
      + "\n  endedAt     now"
      + "\n  heartbeatAt now"
      + `\n\nThe run has ${checkedIn ? "checked in since it opened" : "NEVER checked in"}`
      + ` and has been open ${Math.round(ranForMs / 60_000)} min.`
      + "\nRe-run without --dry-run to perform it.",
    );
    await conn.end();
    process.exit(0);
  }

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
    ⚠ REFRESH HIS NUMBERS, NOW THAT THE ROW IS TERMINAL (#618).

    His question, 2026-09-07: *"how many bugs has it done and worked on its
    still reading as 18 but its been working all night"*. The counter ran at
    shift START and nowhere else, so the figure under each of his switches was
    what a shift FOUND, never what it CLOSED - ten bug cards closed overnight
    and the panel still read the morning's number.

    ⚠ **IT RUNS AFTER THE UPDATE, AND IT CANNOT FAIL THIS COMMAND. THAT
    ORDERING IS THE WHOLE SAFETY ARGUMENT.** A close that dies leaves a run row
    open, which his page renders as a shift still running - #288's incident, and
    the reason #618 refused the child-process road. So the count is taken only
    once the row is safely closed, everything it can raise is caught here, and a
    counting failure costs his panel ONE STALE READING rather than costing a
    shift its close. The catch lives INSIDE `refreshQueueCountsQuietly` so it
    is a driven unit rather than a `try` a later edit can quietly move;
    `server/crewCloseCounts.test.ts` reddens if either half stops holding.

    It is also why nothing here checks for a working `gh` first: on a machine
    without one the reading refuses BY VALUE, this prints the reason, and the
    close still exits on its own verdict.
  */
  console.log("\nrefreshing the numbers under his switches...");
  await refreshQueueCountsQuietly(conn, (line) => console.error(line));

  /*
    THE FINDINGS, both reported only once the row is safely terminal — a check
    that can cost a shift its close is a check that gets skipped, and the record
    of what happened matters more than the discipline note. They are COLLECTED
    rather than each exiting where it stands: a shift that skipped its heartbeat
    AND is closing work on a card he has not judged deserves to read both, and
    an early `exit(2)` on the first would hide the second.
  */
  const findings: string[] = [];

  /*
    ⚠ A CARD WAITING ON HIS EYE OR HIS VERDICT DOES NOT CLOSE (#1349).

    His rule, 2026-09-26: *"yes it shouldnt close if its waiting on my eye and my
    verdict"*. The run row already names the card, and this is the moment a
    shift is deciding that its work is finished — so the reminder belongs here,
    where the card's number is in the shift's hand, rather than in a document.

    ⚠ IT DOES NOT REFUSE, AND THAT IS THIS SCRIPT'S OWN RULE RATHER THAN A SOFT
    TOUCH: refusing would leave the RUN row open, which his page renders as a
    shift still running (#288). The row closes, the finding is printed, and the
    exit code carries it — the same shape the heartbeat finding below has had
    since #295.
  */
  const closingIssue = issueNumberOf(target.cardRef);
  if (closingIssue !== null) {
    const desk = readDeskOrNull();
    if (desk === null) {
      console.error(
        `\n⚠ his Desk could not be read (${path.basename(BRIEFING_PATH)}), so whether`
        + `\n  #${closingIssue} is waiting on his eye is UNKNOWN — not "nothing is waiting".`,
      );
    } else {
      const waiting = deskItemsWaitingOnHim(desk, closingIssue);
      if (waiting.length > 0) findings.push(`\n${waitingOnHimFinding(closingIssue, waiting)}`);
    }
  }

  /*
    THE HEARTBEAT FINDING (#295).

    The bar is HALF the stall window and it DERIVES from that same constant
    rather than inventing a second number: a run past the FULL window with no
    check-in has already shown him the banner, so half is the early warning
    that arrives before it bites. A genuinely short shift — a quiet night, a
    one-line fix — has no meaningful step to stamp and is not a finding.
  */
  if (!checkedIn && ranForMs > CREW_SHIFT_STALL_MS / 2) {
    const minutes = Math.round(ranForMs / 60_000);
    findings.push(
      `\n⚠ FINDING — run #${row.id} ran ${minutes} min and NEVER CHECKED IN.`
      + "\n  `heartbeatAt` still equals `startedAt`, so the heartbeat step in the standing"
      + "\n  orders was skipped for the whole shift. Past the window that reads as"
      + "\n  `no check-in` on his page, over a shift that was working — which is"
      + "\n  issue #295, recurring."
      + "\n"
      + "\n  The step, after every meaningful act (branch cut, PR opened, PR merged,"
      + "\n  edition written):"
      + "\n    railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-start.mts \\"
      + "\n      --note '<what just happened>' [--branch <name>]",
    );
  }

  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error("\n  The row IS closed and correct. Exit 2 is the finding(s) above, not a failure.");
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
