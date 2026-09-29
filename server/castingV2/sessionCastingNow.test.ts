import { describe, expect, it } from "vitest";

import type { CastingSession } from "../../drizzle/schema";
import { CASTING_ROLL_COMPILE_STALE_MS, castingNowAt, projectSession } from "./rollProjection";

/**
 * A SHEET SAYS IT IS CASTING, AND THE SAYING HAS AN EXPIRY (#1454).
 *
 * His report, 2026-09-27: *"if i exit the sheet and then come back into it
 * sheet 4 will not show at all until its finished generating the cards"*.
 *
 * A roll's row is written after its brief has compiled, and the compile is a
 * text call the customer waits through — so for that window `getSession` has
 * no roll to return and a fresh load draws the sheet as idle over a roll he
 * has paid for. `casting_sessions.castingSince` is the fact that fills the
 * window, and this is the reader that turns it into the one boolean the sheet
 * needs.
 *
 * Every road out of the compile clears the stamp, so in ordinary life it never
 * ages — `rollService.test.ts` drives those roads. What is under test HERE is
 * the one road that can leave a stamp behind: a process killed mid-compile,
 * which a deploy does routinely (`deployCollision.test.ts` is this
 * repository's standing account of that collision). Without the bound, one
 * killed process would paint a casting pill on a sheet forever.
 */

const at = (ms: number): CastingSession =>
  ({
    publicId: "sheet-1",
    status: "open",
    originType: "roster",
    signedCastCount: 0,
    createdAt: new Date(0),
    expiresAt: null,
    castingSince: ms === -1 ? null : new Date(ms),
  }) as unknown as CastingSession;

const NOW = new Date(10_000_000);

describe("castingNow", () => {
  it("a sheet with no stamp is not casting", () => {
    /* Every row that exists today, and every sheet between rolls. */
    expect(projectSession(at(-1), NOW).castingNow).toBe(false);
  });

  it("BOTH forms of absence are absence — null from a row, undefined from anywhere else", () => {
    /*
      ⚠ THIS ARM IS A REPAIR, NOT A PRECAUTION. The first shape of the reader
      asked `stamp !== null`, which `undefined` passes, and the next line took
      `.getTime()` of it — so `getSession` threw for any caller holding a
      session object that was not read out of MySQL. Every fixture in this
      repository is such an object, and `castingV2SheetGone.test.ts`'s positive
      control went red the moment the reader shipped.

      Driven at the reader rather than through a session, because a fixture
      typed as `CastingSession` cannot express the `undefined` that caused it.
    */
    expect(castingNowAt(null, NOW)).toBe(false);
    expect(castingNowAt(undefined, NOW)).toBe(false);
    /* The positive control beside them, or a reader that answers false to
       everything passes both. */
    expect(castingNowAt(new Date(NOW.getTime() - 1_000), NOW)).toBe(true);
  });

  it("a stamp written a moment ago IS casting", () => {
    expect(projectSession(at(NOW.getTime() - 1_000), NOW).castingNow).toBe(true);
  });

  it("a stamp older than the bound is treated as absent", () => {
    /*
      The killed-process road. The sheet is NOT casting — nothing is compiling
      anything — and the honest answer is the one the product gave before this
      field existed: no pill, and the rolls that do exist tell the whole story.
    */
    expect(
      projectSession(at(NOW.getTime() - CASTING_ROLL_COMPILE_STALE_MS - 1), NOW).castingNow,
    ).toBe(false);
  });

  it("the bound is generous against the compile it covers, not tight", () => {
    /*
      WORKING LAW 2, POINTED AT THE CONSTANT RATHER THAN THE READER. Being late
      to forget a dead stamp costs a dashed pill that goes away by itself;
      being early costs the fix, because the author road's compile is 40–120 s
      (#466) and the brief bound admits 4,000 characters. So a bound that has
      drifted DOWN toward the compile is a defect, and this is the arm that
      says so. It is not a restatement of the value: it fails at anything under
      four minutes, and the declared five is a minute clear of it.
    */
    expect(CASTING_ROLL_COMPILE_STALE_MS).toBeGreaterThanOrEqual(4 * 60 * 1000);
    /* And bounded above, because a stamp believed for an hour is a pill on a
       sheet nobody is casting on. */
    expect(CASTING_ROLL_COMPILE_STALE_MS).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("the raw instant never crosses the boundary", () => {
    /*
      INVARIANT 8, and the reason the projection answers with a boolean. A
      client handed the timestamp would have to apply the staleness rule
      itself, which is two readers keeping one arithmetic in step — and it is
      an internal write time on a row, which nothing outside needs.
    */
    const projected = projectSession(at(NOW.getTime() - 1_000), NOW) as Record<string, unknown>;
    expect(Object.keys(projected)).not.toContain("castingSince");
    expect(JSON.stringify(projected)).not.toContain(String(NOW.getTime() - 1_000));
  });
});
