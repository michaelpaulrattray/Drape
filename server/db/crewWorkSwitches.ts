/**
 * THE BACKGROUND-WORK SWITCHES AND THE QUEUE COUNTS, at the database
 * (migration 0056; issue #277).
 *
 * EXPLICIT PROJECTIONS throughout (invariant 8) — every column named, no
 * spread, no bare `select()`. The tables hold nothing sensitive today; the
 * discipline is what keeps that true when somebody adds a column tomorrow.
 *
 * # TWO TABLES, TWO WRITERS, AND ONLY ONE OF THEM IS HERE
 *
 * `crew_work_switches` is HIS — `setCrewWorkSwitch` below is its only writer
 * and it is reached solely from `crew.setWorkSwitch`, an `adminProcedure` with
 * his session. Shifts read it through `scripts/crew-work-switches.mts`, which
 * is one SELECT and nothing else.
 *
 * `crew_queue_counts` is the SHIFTS' — and its writer is deliberately NOT in
 * this file. `scripts/crew-count-queue.mts` writes it directly, the way #272's
 * run rows are written, and migration 0055's header carries the argument for
 * that road. **If a mutation to write counts ever appears in `crew.ts`, the
 * split has been broken and that PR needs to say why.**
 *
 * # THE ABSENT TABLE IS A FIRST-CLASS ANSWER (the same law as #272)
 *
 * Both tables land ahead of their production ceremony, which is a founder act,
 * and `crew.getState` is the ONE call the entire Crew tab makes. A reader that
 * threw on an absent table would take his briefing, his replies and his reply
 * box down with it to report that a panel is missing. So a missing table
 * answers `available: false`; the narrow MySQL "table doesn't exist" code is
 * the ONLY failure rescued, so a dropped connection or a permissions fault
 * cannot hide in the same silence.
 *
 * ⚠ **THE WRITE DOES NOT DEGRADE, AND THAT ASYMMETRY IS DELIBERATE.** A read
 * that quietly answers "no switches" is honest — nothing is on. A WRITE that
 * quietly did nothing would tell him he had turned background work off when he
 * had not, which is the exact lie this feature exists to prevent. It throws.
 */
import { eq } from "drizzle-orm";

import {
  CREW_PIPELINE_GROUPS,
  pipelineGroupRowKey,
} from "../../shared/crewPipelineGroups";
import { parseQueueExclusions, type CrewQueueExclusions } from "../../shared/crewQueueExclusions";
import { parsePossiblyDone, type CrewQueuePossiblyDone } from "../../shared/crewQueuePossiblyDone";
import { parseQueueTitles, type CrewQueueTitle } from "../../shared/crewQueueTitles";
import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_SWITCH_KEYS,
  type CrewWorkSwitchKey,
} from "../../shared/crewWorkSwitches";
import { crewQueueCounts, crewWorkSwitches } from "../../drizzle/schema";
import { getDb, type DbInstance } from "./connection";

/** MySQL's "table doesn't exist". */
const ER_NO_SUCH_TABLE = "ER_NO_SUCH_TABLE";

/**
 * MySQL's "unknown column in field list" — `crew_queue_counts.titles` (#285)
 * and `crew_queue_counts.excluded` (#324) before the founder has run their
 * ceremonies.
 *
 * ⚠ **THE SECOND, AND LAST, FAILURE THIS READER RESCUES.** The columns are
 * migrations 0057 and 0058 and production takes each by a ceremony script,
 * which is a founder act — so there is a real window in which this code is
 * deployed and a column is not there. His ENTIRE Crew tab is one
 * `crew.getState` call, so an unrescued throw here is a blank page for the
 * founder, which is the failure the briefing parse arm already exists to
 * prevent. Rescued to exactly today's panel: the counts, with no titles under
 * them and no exclusion clause beside them.
 *
 * ⚠ **THE RETRY DROPS BOTH OPTIONAL COLUMNS, NOT THE ONE IT GUESSES AT.** MySQL
 * names only the FIRST unknown column in the error, so a reader that dropped
 * that one and retried would throw again on the second and, worse, would look
 * like it had a working fallback while having one that fails on the two-absent
 * case. One retry, both columns gone, and the answer is the panel he has today.
 */
const ER_BAD_FIELD_ERROR = "ER_BAD_FIELD_ERROR";

/**
 * Whether this error is the absent table, and nothing else.
 *
 * Walks `cause` — the driver's code arrives wrapped at some call sites and bare
 * at others, a chain that has caught this repository before. A string match on
 * the message is deliberately not used: "doesn't exist" appears in errors that
 * are not this one.
 */
function isMissingTable(error: unknown): boolean {
  return carriesCode(error, ER_NO_SUCH_TABLE);
}

/** Whether this error is the absent COLUMN, and nothing else. Same walk. */
function isMissingColumn(error: unknown): boolean {
  return carriesCode(error, ER_BAD_FIELD_ERROR);
}

/**
 * Whether the driver's code appears anywhere on this error's `cause` chain.
 *
 * Walks `cause` — the code arrives wrapped at some call sites and bare at
 * others, a chain that has caught this repository before. A string match on the
 * message is deliberately not used: "doesn't exist" appears in errors that are
 * not this one.
 */
function carriesCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let hop = 0; hop < 5 && current; hop += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** One category's count, as the page sees it. */
export type CrewQueueCountView = {
  readonly categoryKey: string;
  readonly openCount: number;
  /**
   * The five most recent cards behind that number (#285), or an empty list.
   *
   * Empty and "there are none" are deliberately the same value here, and the
   * panel is what distinguishes them: `queueTitlesView` draws no remainder line
   * when the list is empty, so a category with no titles reads as the count
   * alone rather than as a promise of a list that is not there.
   */
  readonly titles: readonly CrewQueueTitle[];
  /**
   * What was left OUT of `openCount`, keyed by reason (#324).
   *
   * ⚠ **THIS CHANGES WHAT `openCount` ABOVE MEANS, AND THE TWO ARRIVE
   * TOGETHER.** Where the writer could store this, `openCount` is the OFFERED
   * count — cards a shift may actually pick up — and this says what was
   * subtracted. Where it could not, this is `{}` and `openCount` keeps its old
   * meaning, every open card carrying the label. The pair is written in one
   * statement, so it can never describe two moments or two meanings.
   *
   * Empty and "nothing was excluded" are deliberately the same value: the panel
   * draws no clause for either, which is the row he has today.
   */
  readonly excluded: CrewQueueExclusions;
  /**
   * The cards INSIDE `openCount` whose fix may already have landed (#494).
   *
   * ⚠ **THIS ONE CHANGES NOTHING ABOUT WHAT `openCount` MEANS**, which is the
   * whole difference from `excluded` above it. A flagged card is still offered
   * and still counted; the panel says `(14, 2 already queued, 2 possibly
   * fixed)`, where the queued two are out of the fourteen and the flagged two
   * are two of them. His card: *"No card closes from this instrument."*
   *
   * Empty and "nothing was flagged" are deliberately the same value, and so is
   * "the column is not here yet" — all three draw the row he has today.
   */
  readonly possiblyDone: CrewQueuePossiblyDone;
  readonly countedAt: Date;
};

/**
 * What the page gets.
 *
 * `available: false` is NOT "everything is off" — the two look identical in a
 * bare map and mean opposite things to somebody deciding whether the team is
 * idle by his choice or the panel is simply dark. #272's reader makes the same
 * distinction for the same reason.
 */
/**
 * One row of ZONE 2 — a slice of the pipeline he can SEE and can never switch
 * on (#325).
 *
 * ⚠ **THERE IS NO `enabled` HERE AND THERE MUST NEVER BE ONE.** `design-unbuilt`
 * and `roadmap` are feature work, and a switch on either is `PROGRAM.md`'s
 * founder law — *"the team NEVER selects the next feature"* — with a toggle
 * attached. The absence of the field is the control; `server/crewPipelineGroups.test.ts`
 * asserts the two vocabularies share no key so one can never be read as the
 * other.
 */
export type CrewPipelineGroupView = {
  readonly groupKey: string;
  readonly openCount: number;
  readonly titles: readonly CrewQueueTitle[];
  readonly countedAt: Date;
};

export type CrewWorkState = {
  readonly available: boolean;
  /** key → on/off. A key ABSENT from this map is OFF (see `shared/crewWorkSwitches.ts`). */
  readonly switches: Readonly<Record<string, boolean>>;
  readonly counts: readonly CrewQueueCountView[];
  /**
   * The whole pipeline, grouped — including the `switched` row, which is the
   * arithmetic rather than a group (#325). Empty until a shift has counted, and
   * the panel draws nothing rather than zeros in that window: twelve confident
   * zeros and "no shift has looked yet" must not look the same.
   */
  readonly groups: readonly CrewPipelineGroupView[];
  /** When he last changed anything — his card asks the page to say so. */
  readonly changedAt: Date | null;
};

async function requireDb(): Promise<DbInstance> {
  const db = await getDb();
  if (!db) throw new Error("no database connection — the work switches cannot be read or written");
  return db;
}

/**
 * The switches and the counts, in one read.
 *
 * ⚠ **A ROW IS ONLY BELIEVED IF ITS KEY IS ONE WE KNOW.** A `switchKey` the
 * vocabulary does not name is skipped rather than passed through: the map this
 * returns is consumed by `backgroundWorkAllowed`, and an unknown key reaching
 * it could only ever be noise — a renamed category leaving its old row behind,
 * or a hand-written row. Skipping is the safe direction; the unknown key cannot
 * turn anything on because nothing asks for it.
 */
/**
 * The count rows, with the titles where this database has the column.
 *
 * ⚠ **THE FALLBACK IS THE POINT, AND IT IS ONE ROUND TRIP IN ONE WINDOW.**
 * `crew_queue_counts.titles` is migration 0057; production takes it by a
 * founder ceremony, so between the deploy and that command a `SELECT` naming it
 * is `ER_BAD_FIELD_ERROR` — and this projection is inside the ONE call his
 * whole Crew tab makes. The retry drops the column and nothing else, so the
 * degraded answer is the panel he has today rather than an error page.
 *
 * ⚠ **THE RESCUE DROPS ALL THREE OPTIONAL COLUMNS TOGETHER, and that is
 * deliberate rather than lazy.** `titles` (0057), `excluded` (0058) and
 * `possiblyDone` (0061) are each nullable and each added on its own migration,
 * so a database could legitimately hold two of the three — but the driver does
 * not say WHICH column it could not find, and a rescue that guessed would be a
 * reader inventing a schema. Falling all the way back to the count is the one
 * answer that is correct whichever of them is absent, and it is a state the
 * founder has already seen. Since #322 the window is a deploy long: the rite
 * applies an additive migration itself, before the deploy that needs it.
 *
 * Caught rather than probed: a probe would cost `information_schema` on every
 * page load forever to guard a window that closes the day he runs one command.
 * Only `ER_BAD_FIELD_ERROR` is rescued; anything else still throws.
 *
 * EXPORTED for `server/crewQueueCountRescue.test.ts`, which drives all three of
 * its arms — the rescue, the positive control, and a different driver code
 * still throwing. A catch that swallows everything is the real hazard here and
 * a suite that cannot see this function cannot prove it does not.
 */
export async function readCountRows(db: DbInstance): Promise<
  Array<{
    categoryKey: string;
    openCount: number;
    titles: string | null;
    excluded: string | null;
    possiblyDone: string | null;
    countedAt: Date;
  }>
> {
  try {
    return await db
      .select({
        categoryKey: crewQueueCounts.categoryKey,
        openCount: crewQueueCounts.openCount,
        titles: crewQueueCounts.titles,
        excluded: crewQueueCounts.excluded,
        possiblyDone: crewQueueCounts.possiblyDone,
        countedAt: crewQueueCounts.countedAt,
      })
      .from(crewQueueCounts);
  } catch (cause) {
    if (!isMissingColumn(cause)) throw cause;
    const legacy = await db
      .select({
        categoryKey: crewQueueCounts.categoryKey,
        openCount: crewQueueCounts.openCount,
        countedAt: crewQueueCounts.countedAt,
      })
      .from(crewQueueCounts);
    return legacy.map((row) => ({ ...row, titles: null, excluded: null, possiblyDone: null }));
  }
}

/**
 * ONE TABLE, TWO VOCABULARIES — the switch counts and the pipeline groups
 * (#325).
 *
 * ⚠ **THE PREFIX IS THE WHOLE SEPARATION, AND IT IS READ IN BOTH DIRECTIONS.**
 * Group rows share `crew_queue_counts` with the switch counts, which is what
 * makes this feature a row and a line rather than a migration and a founder
 * ceremony — `shared/crewWorkSwitches.ts`'s own header promises that, and
 * #324's exclusions were built on the same promise. The switch filter keys on
 * the bare category names (`bugs`, `process`); the group filter on `group:`
 * keys. Neither set can match the other's rows, and the failure that would
 * matter is one direction only: **a group's number appearing under a switch he
 * can flip** is a control on `design-unbuilt`, which is `PROGRAM.md`'s founder
 * law with a toggle attached.
 *
 * ⚠ **AN UNKNOWN KEY IS DROPPED BY BOTH**, exactly as `readCrewWorkState` drops
 * an unknown `switchKey`: a renamed group leaving its old row behind, or a
 * hand-written row, can only ever be noise. Dropping is the safe direction —
 * the unknown key cannot turn anything on, because nothing asks for it.
 *
 * **ORDERED BY THE VOCABULARY, never by the table.** The panel's group order is
 * MEANING (first match wins in `pipelineGroupFor`, so the order is what his
 * page says about a card carrying two labels), and a row order that drifted
 * would silently reorder the reasons under his counts.
 *
 * EXPORTED for `server/crewPipelineProjection.test.ts`, which drives the split
 * directly — a suite that cannot see this function cannot prove the two
 * populations stay apart.
 */
export function splitCountRows(
  countRows: ReadonlyArray<{
    categoryKey: string;
    openCount: number;
    titles: string | null;
    excluded: string | null;
    possiblyDone: string | null;
    countedAt: Date;
  }>,
): { counts: CrewQueueCountView[]; groups: CrewPipelineGroupView[] } {
  const known = new Set<string>(CREW_WORK_CATEGORIES.map((category) => category.key));
  const counts = countRows
    .filter((row) => known.has(row.categoryKey))
    .map((row) => ({
      categoryKey: row.categoryKey,
      openCount: row.openCount,
      /* Parsed HERE rather than on the client: `crew.getState` is the page's
         whole contract, and a raw JSON string crossing it would make every
         consumer responsible for the same defensive parse. */
      titles: parseQueueTitles(row.titles),
      excluded: parseQueueExclusions(row.excluded),
      possiblyDone: parsePossiblyDone(row.possiblyDone),
      countedAt: row.countedAt,
    }));

  const byRowKey = new Map(countRows.map((row) => [row.categoryKey, row]));
  const groups: CrewPipelineGroupView[] = [];
  for (const group of CREW_PIPELINE_GROUPS) {
    const row = byRowKey.get(pipelineGroupRowKey(group.key));
    /* An ABSENT row is left out rather than drawn as zero. They are opposite
       facts: zero means the queue holds none of these, and absent means no
       shift has counted since this shipped. The panel says which. */
    if (!row) continue;
    groups.push({
      groupKey: group.key,
      openCount: row.openCount,
      titles: parseQueueTitles(row.titles),
      countedAt: row.countedAt,
    });
  }

  return { counts, groups };
}

export async function readCrewWorkState(): Promise<CrewWorkState> {
  const db = await getDb();
  if (!db) return { available: false, switches: {}, counts: [], groups: [], changedAt: null };

  try {
    const switchRows = await db
      .select({
        switchKey: crewWorkSwitches.switchKey,
        enabled: crewWorkSwitches.enabled,
        changedAt: crewWorkSwitches.changedAt,
      })
      .from(crewWorkSwitches);

    const countRows = await readCountRows(db);

    const switches: Record<string, boolean> = {};
    let changedAt: Date | null = null;
    for (const row of switchRows) {
      if (!(CREW_WORK_SWITCH_KEYS as readonly string[]).includes(row.switchKey)) continue;
      switches[row.switchKey] = row.enabled;
      if (changedAt === null || row.changedAt > changedAt) changedAt = row.changedAt;
    }

    const { counts, groups } = splitCountRows(countRows);

    return { available: true, switches, counts, groups, changedAt };
  } catch (cause) {
    if (isMissingTable(cause)) {
      return { available: false, switches: {}, counts: [], groups: [], changedAt: null };
    }
    throw cause;
  }
}

/**
 * Set one switch. HIS road, and the only writer of that table.
 *
 * An upsert on `switchKey`, which is UNIQUE — so the store can never hold two
 * answers for one switch, and "is it on" cannot depend on row order.
 *
 * `changedByUserId` is an ARGUMENT and never an input field: the procedure's
 * schema does not declare it and is `.strict()`, so a forged one is refused at
 * the door rather than being a value this function could ever see (invariant 3).
 *
 * ⚠ It does NOT degrade on an absent table — see this file's header. A write
 * that quietly did nothing would tell him he had switched something when he had
 * not.
 */
export async function setCrewWorkSwitch(input: {
  switchKey: CrewWorkSwitchKey;
  enabled: boolean;
  changedByUserId: number;
}): Promise<{ switchKey: string; enabled: boolean; changedAt: Date }> {
  const db = await requireDb();

  const existing = await db
    .select({ id: crewWorkSwitches.id })
    .from(crewWorkSwitches)
    .where(eq(crewWorkSwitches.switchKey, input.switchKey))
    .limit(1);

  const changedAt = new Date();
  if (existing.length === 1) {
    await db
      .update(crewWorkSwitches)
      .set({ enabled: input.enabled, changedByUserId: input.changedByUserId, changedAt })
      /* Scoped in the statement that writes (invariant 1), by the unique key
         rather than by the id read above — so the read and the write cannot
         disagree about which row this is. */
      .where(eq(crewWorkSwitches.switchKey, input.switchKey));
  } else {
    await db.insert(crewWorkSwitches).values({
      switchKey: input.switchKey,
      enabled: input.enabled,
      changedByUserId: input.changedByUserId,
      changedAt,
    });
  }

  /* Read back rather than trusted: an UPDATE that reported success says the
     statement parsed (working law 1 — the changed row is the fact). */
  const after = await db
    .select({ switchKey: crewWorkSwitches.switchKey, enabled: crewWorkSwitches.enabled, changedAt: crewWorkSwitches.changedAt })
    .from(crewWorkSwitches)
    .where(eq(crewWorkSwitches.switchKey, input.switchKey))
    .limit(1);

  if (after.length !== 1) throw new Error("the switch write reported success and the row is not there");
  return after[0];
}
