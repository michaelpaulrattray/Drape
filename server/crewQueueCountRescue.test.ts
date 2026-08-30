/**
 * THE READ THAT SURVIVES A COLUMN THAT IS NOT THERE YET (#285,
 * `server/db/crewWorkSwitches.ts`'s `readCountRows`).
 *
 * `crew_queue_counts.titles` is migration 0057 and production takes it by
 * `scripts/ceremony-crew-queue-count-titles.mts`, which is a FOUNDER act. So
 * there is a real window — however long he takes to run one command — in which
 * this code is deployed against a table without the column.
 *
 * ⚠ **AND HIS ENTIRE CREW TAB IS ONE `crew.getState` CALL.** An unrescued
 * `ER_BAD_FIELD_ERROR` inside this projection is not a missing feature, it is a
 * BLANK PAGE for the founder — the same failure the briefing parse arm in the
 * deploy rite exists to prevent, arriving through the database instead of
 * through the JSON.
 *
 * Three arms, and the third is the one worth having:
 *
 *   1. the rescue — the column is absent, the counts still arrive;
 *   2. the POSITIVE CONTROL — with the column there, titles actually come
 *      through, so arm 1 cannot pass on a reader that returns nothing either
 *      way;
 *   3. a DIFFERENT driver code still throws — a catch that swallows everything
 *      would pass arms 1 and 2 and hide a real database fault behind a panel
 *      that merely looks under-counted.
 */
import { describe, expect, it } from "vitest";

import { readCountRows } from "./db/crewWorkSwitches";

const COUNTED_AT = new Date("2026-08-30T17:08:18Z");

/** The error shape mysql2 raises, wrapped one hop deep as drizzle delivers it. */
function driverError(code: string): Error {
  const bare = Object.assign(new Error(`${code}: from the driver`), { code });
  return Object.assign(new Error("Failed query"), { cause: bare });
}

/**
 * A database double that answers the SELECT drizzle builds, and can refuse the
 * one naming `titles`.
 *
 * It keys on the SELECTED COLUMNS rather than on a call counter, because the
 * thing under test is precisely *which projection was asked for* — a double
 * that answered "the first call throws" would pass even if the fallback still
 * named the missing column.
 */
function fakeDb(options: { titlesColumn: boolean; failWith?: string }) {
  const calls: string[][] = [];
  return {
    calls,
    db: {
      select(columns: Record<string, unknown>) {
        const names = Object.keys(columns);
        calls.push(names);
        return {
          from() {
            if (names.includes("titles") && !options.titlesColumn) {
              return Promise.reject(driverError(options.failWith ?? "ER_BAD_FIELD_ERROR"));
            }
            const row: Record<string, unknown> = {
              categoryKey: "bugs",
              openCount: 10,
              countedAt: COUNTED_AT,
            };
            if (names.includes("titles")) row.titles = '[{"number":312,"title":"a real card"}]';
            return Promise.resolve([row]);
          },
        };
      },
    },
  };
}

describe("the count read survives a database without the titles column", () => {
  /*
    ⚠ THE POSITIVE CONTROL, FIRST AND DELIBERATELY. If this arm fails, the
    rescue arm below is evidence of nothing — a reader that never returns titles
    would satisfy it for the wrong reason.
  */
  it("CONTROL — with the column there, the titles come through", async () => {
    const { db, calls } = fakeDb({ titlesColumn: true });
    const rows = await readCountRows(db as never);

    expect(rows).toEqual([
      {
        categoryKey: "bugs",
        openCount: 10,
        titles: '[{"number":312,"title":"a real card"}]',
        countedAt: COUNTED_AT,
      },
    ]);
    /* ONE round trip in the ordinary case. The fallback is not a cost the
       founder pays on every page load once his ceremony has run. */
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("titles");
  });

  it("with the column ABSENT, the counts still arrive and the titles are null", async () => {
    const { db, calls } = fakeDb({ titlesColumn: false });
    const rows = await readCountRows(db as never);

    /* The count is the thing that must not be lost: it is what his switch panel
       is FOR, and it worked before this feature existed. */
    expect(rows).toEqual([
      { categoryKey: "bugs", openCount: 10, titles: null, countedAt: COUNTED_AT },
    ]);
    expect(calls).toHaveLength(2);
    /* The retry drops the column and NOTHING else — a fallback that still named
       `titles` would fail identically and forever. */
    expect(calls[1]).not.toContain("titles");
    expect(calls[1]).toEqual(["categoryKey", "openCount", "countedAt"]);
  });

  /*
    ⚠ THE ARM THAT STOPS THIS BEING A BLANKET CATCH. A real fault — a dropped
    table, a connection lost mid-query — must still throw. Rescued, it would
    reach his page as a panel with plausible-looking zeros, which is the
    confident-wrong-number failure this whole card is about.
  */
  it("a DIFFERENT driver error is not rescued — it still throws", async () => {
    const { db, calls } = fakeDb({ titlesColumn: false, failWith: "ER_NO_SUCH_TABLE" });
    await expect(readCountRows(db as never)).rejects.toThrow("Failed query");
    expect(calls).toHaveLength(1);
  });

  it("and neither is an ordinary error carrying no driver code at all", async () => {
    const { db } = fakeDb({ titlesColumn: false, failWith: "SOMETHING_ELSE" });
    await expect(readCountRows(db as never)).rejects.toThrow("Failed query");
  });
});
