/**
 * THE ROW READ THAT ANSWERS "IS THIS DEAD ROW DEAD?" (#1863).
 *
 * Two commands meet a stale shift row — `crew-shift-state.mts`, which an
 * operator runs to LOOK, and the open-run warning inside
 * `crew-shift-start.mts`, which every shift meets at launch. Both need the same
 * reading, so the SELECT lives here once rather than in each of them: a second
 * copy of this query is working law 4's drift, on the pair of scripts that
 * already drifted once (`crew-shift-start --note` stamping the newest row,
 * #1281).
 *
 * # ⚠ IT READS, AND THE BOUNDARY FOLLOWS THE STATEMENTS
 *
 * `server/crewShiftWriterBoundary.test.ts` lists this file beside
 * `crew-shift-state.mts` as a READER — *writes nothing*, not "writes only its
 * own table" — with its own doctored-source control. That list follows the
 * STATEMENTS rather than the command name (its own comment on
 * `crewQueueCount.mts` says so), so moving a read out of the reader script
 * without carrying the pin would have moved it out of the boundary too. That is
 * the hole this paragraph exists to have closed.
 *
 * The judgement itself is NOT here: it is `readRunSupersession` in
 * `shared/crewShiftState.ts`, pure and drivable without a database, which is
 * the only way the floor could be measured over the real rows at all.
 */
import {
  type LaneRunForSupersession,
  type RunSupersession,
  readRunSupersession,
} from "../../shared/crewShiftState.js";
import type { ScriptConnection } from "./dbConnection.mts";

/**
 * Its own binding of the table name, deliberately not imported from either
 * script.
 *
 * The boundary test pins each file's table constant SEPARATELY and says why:
 * *"the pairing is what makes this test say something"* — one shared allowlist
 * could not see a file reaching the wrong table. So this file is pinned to this
 * table, the same way the three writers are pinned to theirs.
 */
const TABLE = "crew_shift_runs";

/** What this reading needs off an open run. Nothing it could write with. */
export type OpenRunForSupersession = {
  readonly id: number;
  readonly shift: string;
  readonly startedAt: Date | string;
  readonly heartbeatAt: Date | string;
};

function millis(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * The verdict for every open run, keyed by row id.
 *
 * ONE query, bounded by the earliest silence among the open rows: a lane-mate
 * that started before every open row went quiet cannot supersede any of them,
 * so there is nothing to gain by reading the whole table. With no open runs it
 * issues no query at all.
 *
 * ⚠ **A failed read THROWS rather than returning an empty map**, and both
 * callers catch it and print *"not readable"* beside the row. An empty map
 * returned from a broken query would read as *"nothing is superseded"* — the
 * absence-only failure this repository has a memory about — and swallowing the
 * error here would also take down `crew-shift-start`, whose job is to open a
 * row and not to answer this question.
 */
export async function readRunSupersessions(
  conn: ScriptConnection,
  openRuns: readonly OpenRunForSupersession[],
  now: number,
): Promise<Map<number, RunSupersession>> {
  const verdicts = new Map<number, RunSupersession>();
  if (openRuns.length === 0) return verdicts;

  const earliestSilence = Math.min(...openRuns.map((run) => millis(run.heartbeatAt)));
  if (!Number.isFinite(earliestSilence)) return verdicts;

  /*
    ⚠ NO LANE FILTER HERE, AND THE SABOTAGE PASS IS WHY. The first draft
    narrowed these rows to the open runs' own lanes before handing them over —
    and deleting that filter left the suite entirely green, because
    `readRunSupersession` already drops a candidate from another lane. A second
    gate on one question is the mirror working law 4 is about, and this one was
    unobservable: nothing could ever tell the two apart. The verdict owns the
    lane question; this owns the TIME bound and nothing else.
  */
  const [rows] = await conn.query<any[]>(
    `SELECT id, shift, startedAt, endedAt
       FROM \`${TABLE}\`
      WHERE endedAt IS NOT NULL AND startedAt > ?
      ORDER BY startedAt ASC`,
    [new Date(earliestSilence)],
  );

  const laneRuns: LaneRunForSupersession[] = rows.map((row: any) => ({
    id: Number(row.id),
    shift: String(row.shift),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  }));

  for (const run of openRuns) {
    verdicts.set(run.id, readRunSupersession({ run, runs: laneRuns, now }));
  }
  return verdicts;
}
