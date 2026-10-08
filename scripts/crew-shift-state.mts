/**
 * WHAT IS RUNNING — the read that did not exist (issue #288).
 *
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-state.mts
 *   railway.cmd run --service MySQL -- npx tsx scripts/crew-shift-state.mts --limit 10
 *
 * # WHY THIS FILE EXISTS AT ALL, AND IT IS THE PART WORTH READING
 *
 * `crew_shift_runs` had two commands and both of them WROTE. `crew-shift-start`
 * opened a run, `crew-shift-close` closed one, and **nothing anywhere printed
 * the current row.** The only way to see what was running was the founder's own
 * page.
 *
 * So on 2026-08-30 an operator wanting to look reached for the closest thing to
 * a reader — the writer, with the safest-sounding word they could think of
 * appended:
 *
 *   … crew-shift-close.mts --outcome shipped --note probe --dry-run
 *
 * `--dry-run` did not exist, was silently ignored, and a RUNNING shift's row
 * was stamped terminal on production. #288's own words: *"the absence of a read
 * is what created the pressure to misuse a write."* The strict-argument refusal
 * and the real `--dry-run` now on both writers close the mechanism; **this file
 * closes the reason.**
 *
 * # ⚠ IT CANNOT WRITE, AND THAT IS PINNED RATHER THAN PROMISED
 *
 * `server/crewShiftWriterBoundary.test.ts` reads this file's bytes and asserts
 * it issues no INSERT, UPDATE, DELETE or DDL — with a positive control, because
 * a boundary arm that cannot go red is the thing it is guarding against. A
 * reader that is read-only "by convention" is one helpful edit from being a
 * third writer, and that edit would look like a favour.
 *
 * # WHAT IT PRINTS
 *
 * Every OPEN run — normally none or one — with the verdict his page derives
 * (`deriveShiftRunState`), whether it has ever checked in, and whether it looks
 * LIVE by the same `looksLive` the close script REFUSES on. The three answers
 * come from `shared/crewShiftState.ts` and not from a second implementation
 * here: an operator staring at a refusal must be able to see the same fact that
 * caused it, or the refusal reads as a bug.
 *
 * ⚠ **AND SINCE #1863, WHETHER THAT ROW'S PROCESS IS DEAD.** The three answers
 * above all describe the ROW; none of them could tell a shift whether anybody
 * was still at the other end, so when a builder seat's row went quiet at 08:07Z
 * and sat on his Working-now table for **9.5 hours**, four consecutive shifts
 * met it and all four correctly declined to close it — *"no written confirmation
 * of that seat's death exists."* The fourth line of each open run is now
 * `readRunSupersession`'s reading: **later sessions of the same launcher that
 * opened AND CLOSED while this row sat silent**, which is a positive fact about
 * the rows rather than silence re-read as death. It is a citation, not an
 * instruction — the close stays the shift's own act.
 *
 * Then the last few closed runs, newest first, so "what happened last night" is
 * one command rather than a page.
 *
 * ⚠ **AND A CLOSED RUN'S MINUTES ARE ITS PROVABLE LIFE, NOT ITS STAMP SPAN
 * (#2086).** This printed `endedAt - startedAt` and called it a shift's length;
 * `endedAt` is a stamp any later shift may apply at any hour, so #613 read as
 * **303 minutes for a 19-minute life** and #607 as 693 for 15. The figure is
 * now `startedAt` to the last check-in, and a row stamped closed more than a
 * minute after that check-in says so on its own line rather than quietly
 * carrying a lifetime it never had.
 */
import {
  CREW_SHIFT_LIVE_HEARTBEAT_MS,
  deriveShiftRunState,
  describeRunSupersession,
  describeShiftAge,
  hasEverCheckedIn,
  laneRunLastProofOfLife,
  looksLive,
  type RunSupersession,
} from "../shared/crewShiftState.js";
import { readRunSupersessions } from "./lib/crewRunSupersession.mts";
import { openDatabase, resolveDatabaseUrl, worldOf } from "./lib/dbConnection.mts";
import { parseStrictArgsOrRefuse } from "./lib/strictArgs.mts";

const TABLE = "crew_shift_runs";

const ARGS = parseStrictArgsOrRefuse(process.argv.slice(2), {
  value: ["limit"],
  boolean: [],
});

const limitArg = ARGS.value("limit");
if (limitArg !== null && !/^\d+$/.test(limitArg)) {
  console.error("REFUSING: --limit must be a number.");
  process.exit(1);
}
/* Three is #272's own figure — *"the last three shifts"* beside the running
   one — so the default is quoted rather than chosen. */
const LIMIT = Math.min(limitArg === null ? 3 : Number(limitArg), 50);

/** UTC ISO, never a locale string — see `crew-shift-start.mts`'s note. */
function iso(value: unknown): string {
  return value instanceof Date ? `${value.toISOString().replace("T", " ").slice(0, 19)} UTC` : String(value);
}

/* MOVED to `shared/crewShiftState.ts` as `describeShiftAge` (#1866) — the seat
   cut needs the same sentence, and a second copy of a formatter two readers
   print is the drift working law 4 is about. Kept as a local alias so the
   printing below reads as it did. */
const ago = describeShiftAge;

/** Which world answered — the same plain naming both writers print. */
function whichWorld(): "PRODUCTION" | "DEV" {
  return process.env.MYSQL_PUBLIC_URL ? "PRODUCTION" : "DEV";
}

await import("dotenv/config");
const url = resolveDatabaseUrl();
if (!url) {
  console.error("REFUSING: no database URL. Set DATABASE_URL in .env, or wrap in `railway.cmd run --service MySQL`.");
  process.exit(1);
}

const conn = await openDatabase(url);
console.log(`world: ${whichWorld()} · ${worldOf(url)}`);

try {
  /* Working law 2 — the existence reader gets a control before its negative
     counts for anything. An empty answer and a wrong database look identical. */
  const [control] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
  if (control.length !== 1) {
    throw new Error("the existence reader cannot see `users` — wrong database, or a reader that cannot say yes.");
  }
  const [present] = await conn.query<any[]>(`SHOW TABLES LIKE '${TABLE}'`);
  if (present.length !== 1) {
    throw new Error(`\`${TABLE}\` does not exist in this world (migration 0055).`);
  }

  const now = Date.now();

  const [open] = await conn.query<any[]>(
    `SELECT id, shift, seat, workKind, cardRef, cardTitle, intent, branch, startedAt, heartbeatAt
       FROM \`${TABLE}\` WHERE endedAt IS NULL ORDER BY id DESC`,
  );

  /*
    ⚠ IS A ROW DEAD? — the question four consecutive shifts could not answer
    about row #548 while his Working-now table vouched for it for 9.5 hours
    (#1863). Read beside the states rather than instead of them, and wrapped:
    a failed lane read must cost this command a LINE and never its answer,
    because the reason this file exists is that an operator wanting to look
    reached for a writer instead.
  */
  let supersessions = new Map<number, RunSupersession>();
  let supersessionFailed: string | null = null;
  try {
    supersessions = await readRunSupersessions(conn, open, now);
  } catch (cause) {
    supersessionFailed = (cause as Error).message;
  }

  console.log("");
  if (open.length === 0) {
    console.log("RUNNING: nothing. His page reads `Nothing running`.");
  } else {
    console.log(`RUNNING: ${open.length} open run(s)`);
    for (const row of open) {
      const state = deriveShiftRunState({ heartbeatAt: row.heartbeatAt, endedAt: null }, now);
      const live = looksLive({ startedAt: row.startedAt, heartbeatAt: row.heartbeatAt }, now);
      const checkedIn = hasEverCheckedIn({ startedAt: row.startedAt, heartbeatAt: row.heartbeatAt });
      console.log(
        `\n  #${row.id} ${row.shift} (${row.seat}, ${row.workKind})`
        + `${row.cardRef ? ` on ${row.cardRef}` : ""} — ${state.toUpperCase()}`,
      );
      if (row.cardTitle) console.log(`     card:   ${row.cardTitle}`);
      console.log(`     intent: ${row.intent}`);
      if (row.branch) console.log(`     branch: ${row.branch}`);
      console.log(`     opened ${iso(row.startedAt)} (${ago(row.startedAt, now)})`);
      console.log(
        `     last check-in ${checkedIn ? `${ago(row.heartbeatAt, now)}` : "NEVER — heartbeatAt still equals startedAt"}`,
      );
      /* The refusal an operator would meet, stated BEFORE they meet it. */
      console.log(
        live
          ? `     ⚠ LOOKS LIVE (checked in inside ${CREW_SHIFT_LIVE_HEARTBEAT_MS / 60_000} min)`
            + " — crew-shift-close will REFUSE this row without --force."
          : "     closeable — crew-shift-close would take this row without --force.",
      );
      /* `closeable` above answers whether the TOOL would take the row; this
         answers whether it SHOULD be taken, which is the question that cost
         four shifts a paragraph each and his page 9.5 hours of a false
         sentence. A verdict here is a citation: paste the line. */
      const verdict = supersessions.get(row.id);
      console.log(
        `     ${
          verdict
            ? describeRunSupersession(verdict)
            : `supersession: not readable — the lane read failed (${supersessionFailed ?? "no reading taken"})`
        }`,
      );
    }
  }

  const [closed] = await conn.query<any[]>(
    `SELECT id, shift, seat, outcome, outcomeNote, prNumber, startedAt, heartbeatAt, endedAt
       FROM \`${TABLE}\` WHERE endedAt IS NOT NULL ORDER BY id DESC LIMIT ${LIMIT}`,
  );
  console.log(`\nLAST ${closed.length} CLOSED:`);
  for (const row of closed) {
    /*
      ⚠ THE FIGURE IS THE ROW'S PROVABLE LIFE, NOT ITS STAMP SPAN (#2086).
      `endedAt - startedAt` was printed here as "a shift's length", and
      `endedAt` is a stamp any later shift may apply at any hour — so row #613
      printed **303 min for a 19-minute life** and #607 printed 693 for 15.
      Over production's 54 honestly stamped rows the two readings run median 57
      against 35 and max 693 against 128.

      The lifetime comes from `shared/crewShiftState.ts` and not from a second
      implementation here, for the same reason the three verdicts above do: the
      seat cut and his page read that one owner. A row that never checked in
      falls back to the close stamp, so every row closed before #1872 prints
      exactly what it printed before and nothing else is said about it.
    */
    const started = new Date(row.startedAt).getTime();
    const lifeEnd = laneRunLastProofOfLife({
      id: Number(row.id),
      shift: String(row.shift),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      heartbeatAt: row.heartbeatAt ?? null,
    });
    const minutes = Math.round((lifeEnd - started) / 60_000);
    const lateCloseMinutes = Math.round((new Date(row.endedAt).getTime() - lifeEnd) / 60_000);
    console.log(
      `  #${row.id} ${row.shift} (${row.seat}) — ${row.outcome}`
      + `${row.prNumber ? ` · PR #${row.prNumber}` : ""} · ${minutes} min alive · ended ${ago(row.endedAt, now)}`,
    );
    /* A minute's rounding slack: the figure is minutes, and a close one tick
       after the last check-in is an ordinary close rather than a late stamp. */
    if (lateCloseMinutes > 1) {
      console.log(
        `     ⚠ stamped closed ${lateCloseMinutes} min after its last check-in — the`
        + ` ${minutes} min above is its PROVABLE life, not ${Math.round((new Date(row.endedAt).getTime() - started) / 60_000)} min of stamp span.`,
      );
    }
    if (row.outcomeNote) console.log(`     ${row.outcomeNote}`);
  }

  console.log("\nThis command wrote nothing. To close a run: scripts/crew-shift-close.mts --outcome … (add --dry-run to rehearse).");
} catch (cause) {
  console.error(`FAILED: ${(cause as Error).message}`);
  await conn.end();
  process.exit(1);
}

await conn.end();
process.exit(0);
