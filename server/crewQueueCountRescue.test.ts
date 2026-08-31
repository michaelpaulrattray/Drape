/**
 * THE READ THAT SURVIVES A COLUMN THAT IS NOT THERE YET (#285 and #324,
 * `server/db/crewWorkSwitches.ts`'s `readCountRows`).
 *
 * `crew_queue_counts.titles` is migration 0057 and `crew_queue_counts.excluded`
 * is migration 0058; production takes each by a ceremony script, which is a
 * FOUNDER act. So there is a real window — however long he takes to run one
 * command — in which this code is deployed against a table without a column it
 * names.
 *
 * ⚠ **AND HIS ENTIRE CREW TAB IS ONE `crew.getState` CALL.** An unrescued
 * `ER_BAD_FIELD_ERROR` inside this projection is not a missing feature, it is a
 * BLANK PAGE for the founder — the same failure the briefing parse arm in the
 * deploy rite exists to prevent, arriving through the database instead of
 * through the JSON.
 *
 * The arms, and the last two are the ones worth having:
 *
 *   1. the rescue — a column is absent, the counts still arrive;
 *   2. the POSITIVE CONTROL — with the columns there, titles and exclusions
 *      actually come through, so arm 1 cannot pass on a reader that returns
 *      nothing either way;
 *   3. ⚠ **ONE column absent still rescues** — MySQL names only the FIRST
 *      unknown column in its error, so a reader that dropped the named one and
 *      retried would throw again on the second while LOOKING like it had a
 *      working fallback. The retry drops both, always;
 *   4. a DIFFERENT driver code still throws — a catch that swallows everything
 *      would pass every arm above and hide a real database fault behind a panel
 *      that merely looks under-counted.
 */
import { describe, expect, it } from "vitest";

import { readCountRows } from "./db/crewWorkSwitches";

const COUNTED_AT = new Date("2026-08-30T17:08:18Z");
const TITLES = '[{"number":312,"title":"a real card"}]';
const EXCLUDED = '{"ordered":2}';

/** The columns that arrive by ceremony, and may therefore be absent. */
const OPTIONAL = ["titles", "excluded"] as const;

/** The error shape mysql2 raises, wrapped one hop deep as drizzle delivers it. */
function driverError(code: string): Error {
  const bare = Object.assign(new Error(`${code}: from the driver`), { code });
  return Object.assign(new Error("Failed query"), { cause: bare });
}

/**
 * A database double that answers the SELECT drizzle builds, and refuses any
 * projection naming a column this world does not have.
 *
 * It keys on the SELECTED COLUMNS rather than on a call counter, because the
 * thing under test is precisely *which projection was asked for* — a double
 * that answered "the first call throws" would pass even if the fallback still
 * named a missing column.
 */
function fakeDb(options: { has: readonly string[]; failWith?: string }) {
  const calls: string[][] = [];
  return {
    calls,
    db: {
      select(columns: Record<string, unknown>) {
        const names = Object.keys(columns);
        calls.push(names);
        return {
          from() {
            const absent = OPTIONAL.filter((c) => names.includes(c) && !options.has.includes(c));
            if (absent.length > 0) {
              return Promise.reject(driverError(options.failWith ?? "ER_BAD_FIELD_ERROR"));
            }
            const row: Record<string, unknown> = {
              categoryKey: "bugs",
              openCount: 10,
              countedAt: COUNTED_AT,
            };
            if (names.includes("titles")) row.titles = TITLES;
            if (names.includes("excluded")) row.excluded = EXCLUDED;
            return Promise.resolve([row]);
          },
        };
      },
    },
  };
}

describe("the count read survives a database missing a ceremony's column", () => {
  /*
    ⚠ THE POSITIVE CONTROL, FIRST AND DELIBERATELY. If this arm fails, every
    rescue arm below is evidence of nothing — a reader that never returns the
    optional columns would satisfy them for the wrong reason.
  */
  it("CONTROL — with both columns there, the titles and the exclusions come through", async () => {
    const { db, calls } = fakeDb({ has: ["titles", "excluded"] });
    const rows = await readCountRows(db as never);

    expect(rows).toEqual([
      {
        categoryKey: "bugs",
        openCount: 10,
        titles: TITLES,
        excluded: EXCLUDED,
        countedAt: COUNTED_AT,
      },
    ]);
    /* ONE round trip in the ordinary case. The fallback is not a cost the
       founder pays on every page load once his ceremonies have run. */
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.arrayContaining(["titles", "excluded"]));
  });

  it("with BOTH columns absent, the counts still arrive and both read as null", async () => {
    const { db, calls } = fakeDb({ has: [] });
    const rows = await readCountRows(db as never);

    /* The count is the thing that must not be lost: it is what his switch panel
       is FOR, and it worked before either feature existed. */
    expect(rows).toEqual([
      { categoryKey: "bugs", openCount: 10, titles: null, excluded: null, countedAt: COUNTED_AT },
    ]);
    expect(calls).toHaveLength(2);
    /* The retry drops the optional columns and NOTHING else — a fallback that
       still named one would fail identically and forever. */
    expect(calls[1]).toEqual(["categoryKey", "openCount", "countedAt"]);
  });

  /*
    ⚠ THE ARM #324 ADDED, AND THE REASON IT IS NOT REDUNDANT.

    MySQL's ER_BAD_FIELD_ERROR names only the FIRST unknown column. A reader
    that parsed that name, dropped that one column and retried would throw again
    on the second — while passing the both-absent arm above, because there the
    retry drops everything anyway. The one-absent case is where such a reader
    fails, and it is the state this repository is actually IN between the two
    ceremonies: `titles` ran on production 2026-08-30, `excluded` has not.
  */
  it("⚠ with ONLY the newer column absent, it still rescues — the retry drops both", async () => {
    const { db, calls } = fakeDb({ has: ["titles"] });
    const rows = await readCountRows(db as never);

    expect(rows).toEqual([
      { categoryKey: "bugs", openCount: 10, titles: null, excluded: null, countedAt: COUNTED_AT },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(["categoryKey", "openCount", "countedAt"]);
  });

  /*
    ⚠ THE ARM THAT STOPS THIS BEING A BLANKET CATCH. A real fault — a dropped
    table, a connection lost mid-query — must still throw. Rescued, it would
    reach his page as a panel with plausible-looking zeros, which is the
    confident-wrong-number failure this whole card is about.
  */
  it("a DIFFERENT driver error is not rescued — it still throws", async () => {
    const { db, calls } = fakeDb({ has: [], failWith: "ER_NO_SUCH_TABLE" });
    await expect(readCountRows(db as never)).rejects.toThrow("Failed query");
    expect(calls).toHaveLength(1);
  });

  it("and neither is an ordinary error carrying no driver code at all", async () => {
    const { db } = fakeDb({ has: [], failWith: "SOMETHING_ELSE" });
    await expect(readCountRows(db as never)).rejects.toThrow("Failed query");
  });
});
