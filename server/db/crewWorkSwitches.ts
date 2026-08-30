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
 * before the founder has run its ceremony.
 *
 * ⚠ **THE SECOND, AND LAST, FAILURE THIS READER RESCUES.** The column is
 * migration 0057 and production takes it by
 * `scripts/ceremony-crew-queue-count-titles.mts`, which is a founder act — so
 * there is a real window in which this code is deployed and the column is not
 * there. His ENTIRE Crew tab is one `crew.getState` call, so an unrescued
 * throw here is a blank page for the founder, which is the failure the briefing
 * parse arm already exists to prevent. Rescued to exactly today's panel: the
 * counts, with no titles under them.
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
export type CrewWorkState = {
  readonly available: boolean;
  /** key → on/off. A key ABSENT from this map is OFF (see `shared/crewWorkSwitches.ts`). */
  readonly switches: Readonly<Record<string, boolean>>;
  readonly counts: readonly CrewQueueCountView[];
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
  Array<{ categoryKey: string; openCount: number; titles: string | null; countedAt: Date }>
> {
  try {
    return await db
      .select({
        categoryKey: crewQueueCounts.categoryKey,
        openCount: crewQueueCounts.openCount,
        titles: crewQueueCounts.titles,
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
    return legacy.map((row) => ({ ...row, titles: null }));
  }
}

export async function readCrewWorkState(): Promise<CrewWorkState> {
  const db = await getDb();
  if (!db) return { available: false, switches: {}, counts: [], changedAt: null };

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

    /* Counts are filtered the same way and for the same reason. */
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
        countedAt: row.countedAt,
      }));

    return { available: true, switches, counts, changedAt };
  } catch (cause) {
    if (isMissingTable(cause)) return { available: false, switches: {}, counts: [], changedAt: null };
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
