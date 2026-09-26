/**
 * THE LIVE SHIFT ROW — the shifts' half, at the database (migration 0055;
 * issue #272).
 *
 * ONE STATEMENT, and it is an EXPLICIT PROJECTION (invariant 8). No join, no
 * spread, every column named — the same law `crewReplies.ts` states at length,
 * applied here even though the table holds nothing sensitive today. That is the
 * point of by-construction: a column added tomorrow cannot leak through this
 * surface because nobody remembered to omit it.
 *
 * # THERE IS NO WRITER IN THIS FILE, AND ITS ABSENCE IS THE BOUNDARY
 *
 * `crewReplies.ts` holds a reader AND an insert, because the founder writes his
 * replies through `crew.reply`. Nothing writes a shift run through the server:
 * the writers are `scripts/crew-shift-start.mts` and
 * `scripts/crew-shift-close.mts`, which a shift runs against the database
 * directly, and migration 0055's header carries the argument for that.
 *
 * So this file is a READER, whole and entire. If a mutation ever appears in
 * `crew.ts` that writes here, the split migration 0055 describes has been
 * broken and that PR needs to say why.
 *
 * # THE ABSENT TABLE IS A FIRST-CLASS ANSWER, NOT AN ERROR
 *
 * `crew_shift_runs` lands ahead of its production ceremony, which is a founder
 * act. Between the deploy and the ceremony the table does not exist — and
 * `crew.getState` is the ONE call the entire Crew tab makes. A reader that
 * threw on an absent table would take his briefing, his replies and his reply
 * box down with it in order to report that a status strip is missing.
 *
 * So a missing table returns `available: false` and the page says the strip is
 * not live yet. Every OTHER database failure still throws: the narrow MySQL
 * "table doesn't exist" code is the only thing rescued, so a dropped connection
 * or a permissions fault cannot hide inside the same silence.
 *
 * ⚠ This deliberately differs from `crewReplies.ts`, which throws on a missing
 * database because an empty thread is a meaningful answer there. Here the
 * meaningful answers are "nothing running" and "not migrated yet", and they are
 * different sentences.
 */
import { desc, isNotNull, isNull } from "drizzle-orm";

import { crewShiftRuns } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * How many FINISHED runs the page receives.
 *
 * #272 asks for the running one "plus the last three shifts", so three is his
 * own number for the past and it has not moved.
 *
 * ⚠ **THE OPEN RUNS ARE NOT CAPPED, AND THAT IS THE WHOLE OF #1358.** This
 * file held one `CREW_SHIFT_RUN_LIMIT = 4` over a single newest-first query,
 * chosen when exactly one shift ran at a time: the running row on top and three
 * behind it. The runner now launches up to four builder seats in one pass
 * (#1281), so on the first evening it did, **four rows were open and a fifth
 * would not have reached the page at all** — a seat working on his product,
 * invisible, with nothing anywhere saying a row had been dropped. A cap on the
 * open list can only ever hide a working seat, so there is none: the open list
 * is every open row, and the ceiling on it is the team's own size.
 */
const CREW_SHIFT_PAST_LIMIT = 3;

/**
 * One run as the page sees it.
 *
 * There is no `status` here and there must not be — see `deriveShiftRunState`.
 * The page is handed the timestamps and derives the verdict itself, so the
 * server and the client can never disagree about what "stalled" means.
 */
type CrewShiftRunView = {
  readonly id: number;
  readonly shift: string;
  readonly seat: string;
  readonly workKind: string;
  readonly cardRef: string | null;
  readonly cardTitle: string | null;
  readonly intent: string;
  readonly branch: string | null;
  readonly startedAt: Date;
  readonly heartbeatAt: Date;
  readonly endedAt: Date | null;
  readonly outcome: string | null;
  readonly outcomeNote: string | null;
  readonly prNumber: number | null;
};

/**
 * What the page gets: the runs, and whether the store could be read at all.
 *
 * `available: false` is NOT "no runs" — the two look identical in a bare array
 * and mean opposite things to somebody deciding whether the team is idle or the
 * instrument is dark. `crewReplies`' own design calls that class out: a
 * configuration fault wearing the clothes of a fact.
 *
 * ⚠ **TWO LISTS, BECAUSE ONE FLAT LIST IS WHAT PRODUCED #1358.** The page used
 * to receive four rows newest-first and work out which one was current itself —
 * `runs.find((run) => run.endedAt === null)`, singular, and every other open row
 * fell through into "Recent shifts" as though it had finished. The split belongs
 * on this side: the two statements below already separate them, so handing the
 * page one list makes it re-derive a fact this file measured, and there is only
 * one way to get that wrong.
 *
 * `past` is the last three FINISHED runs and never an open one; `open` is every
 * open row, newest first, uncapped.
 */
export type CrewShiftRuns = {
  readonly available: boolean;
  readonly open: readonly CrewShiftRunView[];
  readonly past: readonly CrewShiftRunView[];
};

/** MySQL's "table doesn't exist". The ONLY failure this reader rescues. */
const ER_NO_SUCH_TABLE = "ER_NO_SUCH_TABLE";

/**
 * Whether this error is the absent table, and nothing else.
 *
 * Walks `cause`, because the driver's code arrives wrapped at some call sites
 * and bare at others — the same chain that has caught this repository twice
 * before (memory: *driver error code chain*). A string match on the message is
 * deliberately NOT used: "doesn't exist" appears in errors that are not this.
 */
function isMissingTable(error: unknown): boolean {
  let current: unknown = error;
  for (let hop = 0; hop < 5 && current; hop += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === ER_NO_SUCH_TABLE) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The open runs and the last three finished ones, newest first.
 *
 * Ordered by `id` rather than `startedAt`: two runs can share a second, and a
 * tie in the ORDER BY would let the page draw a finished shift above the one
 * that is running. `id` is the insertion order and cannot tie.
 *
 * # TWO STATEMENTS, AND THE ORDER OF THEM IS THE ONLY RACE THERE IS
 *
 * One statement cannot say *every open row plus exactly three closed ones*:
 * MySQL 8 refuses a `LIMIT` inside an `IN` subquery, and a single newest-first
 * page is precisely the shape that hid four seats (#1358). So the open rows and
 * the past rows are read separately, and they are read in THAT order on purpose.
 *
 * A run that closes between the two — a 30-second poll window — comes back in
 * BOTH, and is kept in `open`: it is drawn one poll longer as working with its
 * last check-in beside it, which is a stale reading that corrects itself. Read
 * the other way round it would land in NEITHER and vanish from his page for a
 * poll, and a shift that disappears is the failure this surface exists to
 * prevent. The dedupe below is what makes the choice hold rather than showing
 * one run twice.
 */
export async function listCrewShiftRuns(): Promise<CrewShiftRuns> {
  const db = await getDb();
  /* No database at all is a configuration fault, not an absent table — but it
     is also not something to take the whole Crew tab down for, since the
     briefing renders from a file and his replies would have failed first. */
  if (!db) return { available: false, open: [], past: [] };

  /* One projection, named once, for both statements — invariant 8 with a single
     place to add a column to rather than two that can disagree. */
  const columns = {
    id: crewShiftRuns.id,
    shift: crewShiftRuns.shift,
    seat: crewShiftRuns.seat,
    workKind: crewShiftRuns.workKind,
    cardRef: crewShiftRuns.cardRef,
    cardTitle: crewShiftRuns.cardTitle,
    intent: crewShiftRuns.intent,
    branch: crewShiftRuns.branch,
    startedAt: crewShiftRuns.startedAt,
    heartbeatAt: crewShiftRuns.heartbeatAt,
    endedAt: crewShiftRuns.endedAt,
    outcome: crewShiftRuns.outcome,
    outcomeNote: crewShiftRuns.outcomeNote,
    prNumber: crewShiftRuns.prNumber,
  };

  try {
    /* Every open row. No `LIMIT` — see `CREW_SHIFT_PAST_LIMIT`'s docblock. */
    const open = await db
      .select(columns)
      .from(crewShiftRuns)
      .where(isNull(crewShiftRuns.endedAt))
      .orderBy(desc(crewShiftRuns.id));

    const past = await db
      .select(columns)
      .from(crewShiftRuns)
      .where(isNotNull(crewShiftRuns.endedAt))
      .orderBy(desc(crewShiftRuns.id))
      .limit(CREW_SHIFT_PAST_LIMIT);

    const openIds = new Set(open.map((run) => run.id));
    return { available: true, open, past: past.filter((run) => !openIds.has(run.id)) };
  } catch (cause) {
    if (isMissingTable(cause)) return { available: false, open: [], past: [] };
    throw cause;
  }
}
