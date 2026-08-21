/**
 * `CASTING_TWO_PATHS_SCOPE` — the door on the two paths, LANDED DARK (design
 * `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §10, countersigned fable-1334;
 * built after the production ceremony, fable-1356 §2).
 *
 * What these arms hold it to:
 *
 *   1. the LADDER — off by default, absent means off, and it cannot be armed
 *      over a user `CASTING_V2_SCOPE` does not cover;
 *   2. THE PARENT IS THE CLAIM, and it is the one thing about this flag that is
 *      easy to get wrong by analogy. Every other sub-flag on this road hangs
 *      off `CASTING_REPAINT_SCOPE`, because every other one gates something a
 *      REFINE does. This gates the ROLL. An arm below names the parent
 *      explicitly so that "made it match its neighbours" cannot be a silent
 *      change;
 *   3. **EVERY ARM ASSERTS ITS OWN REASON.** A refusal matched on a bare
 *      `/CASTING_V2_SCOPE/` would pass against four other flags' messages —
 *      five rehearsal arms once printed PROVEN over exactly that mistake — so
 *      the message arms name `CASTING_TWO_PATHS_SCOPE` too.
 *
 * ⚠ **What is NOT here yet, said rather than left to be noticed.** There is no
 * "the gate, both sides" block, because on the commit that lands this flag
 * there is no behaviour on either side of it to assert: the columns exist, the
 * flag exists, and nothing yet reads one to decide anything. A pair of arms
 * over a difference that does not exist is a control that cannot fail, and the
 * suite would have been GREENER for containing it. Those arms land with the
 * slice that gives the flag something to gate, and the design's §7.3 census
 * rows are the same promise at the product's own boundary.
 */
import { describe, expect, it } from "vitest";

import {
  CastingTwoPathsCoverageError,
  CastingTwoPathsScopeConfigurationError,
  parseCastingTwoPathsScope,
  validateCastingTwoPathsEnvironment,
} from "./castingV2Scope";
import { CASTING_PATHS, DEFAULT_CASTING_PATH, isCastingPath } from "../../shared/castingPaths";

describe("the boot guard", () => {
  it("refuses while casting itself is off — a path is chosen when a roll is bought", () => {
    expect(() => validateCastingTwoPathsEnvironment({
      scope: "users:1",
      castingScope: undefined,
    })).toThrow(CastingTwoPathsCoverageError);
  });

  it("refuses `all` while the parent is limited to named users", () => {
    expect(() => validateCastingTwoPathsEnvironment({
      scope: "all",
      castingScope: "users:1",
    })).toThrow(CastingTwoPathsCoverageError);
  });

  it("⚠ names the user it refuses AND the flag doing the refusing", () => {
    /*
      Both halves, because either alone is satisfied by the wrong message. The
      user id alone would pass against any sibling flag's coverage error; the
      flag name alone would pass against a message that refused the wrong user.
    */
    expect(() => validateCastingTwoPathsEnvironment({
      scope: "users:1,7",
      castingScope: "users:1",
    })).toThrow(/CASTING_TWO_PATHS_SCOPE .*names users outside CASTING_V2_SCOPE: 7/);
  });

  it("⚠ hangs off CASTING_V2_SCOPE and not off the repaint scope", () => {
    /*
      THE ARM AGAINST TIDYING. Six sibling flags on this road name
      `CASTING_REPAINT_SCOPE` as their parent and this one does not, so the
      cheapest possible wrong edit — making it consistent with its neighbours —
      is the one that must not pass quietly.

      It is asserted through the REFUSAL MESSAGE rather than by reading the
      implementation, so it holds whatever the internals become: a guard that
      started naming the repaint scope would say so here.
    */
    let message = "";
    try {
      validateCastingTwoPathsEnvironment({ scope: "users:1", castingScope: "off" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("CASTING_V2_SCOPE is off");
    expect(message).not.toContain("CASTING_REPAINT_SCOPE");
  });

  it("admits a covered user, and `all` under an `all` parent", () => {
    expect(validateCastingTwoPathsEnvironment({
      scope: "users:1",
      castingScope: "users:1,2",
    })).toEqual({ kind: "users", userIds: [1] });
    expect(validateCastingTwoPathsEnvironment({
      scope: "all",
      castingScope: "all",
    })).toEqual({ kind: "all" });
  });

  it("lets `off` through untouched, whatever the parent is", () => {
    /* Nothing to cover, so nothing to refuse — and this is the state on every
       deployment today, which is what makes the landing dark. */
    expect(validateCastingTwoPathsEnvironment({ scope: undefined, castingScope: undefined }))
      .toEqual({ kind: "off" });
    expect(validateCastingTwoPathsEnvironment({ scope: "off", castingScope: undefined }))
      .toEqual({ kind: "off" });
  });

  it("refuses a scope that is not the grammar", () => {
    for (const raw of ["yes", "users:", "users:0", "users:1,1", "users:-2", "everyone"]) {
      expect(() => parseCastingTwoPathsScope(raw), raw)
        .toThrow(CastingTwoPathsScopeConfigurationError);
    }
  });

  it("absent means off", () => {
    expect(parseCastingTwoPathsScope(undefined)).toEqual({ kind: "off" });
  });
});

describe("the vocabulary the flag opens", () => {
  it("is his two words and no third", () => {
    /*
      A third path is a migration and a decision, in that order — the column is
      a closed enum under `STRICT_TRANS_TABLES` precisely so that a third word
      ERRORS at the insert rather than being written and read back as something
      no reader handles. This arm is the code-side half of that fence.
    */
    expect([...CASTING_PATHS]).toEqual(["wardrobe", "basics"]);
  });

  it("⚠ does not admit the ABSENCE as a member", () => {
    /*
      `null` means *cast before the paths existed*, and the migration argues at
      length why it must never become a spelled value: a DEFAULT would stamp
      every historical roll with a path it was not cast on, and the loss is
      permanent because the distinction destroyed is the only evidence of which
      rolls predate the feature.

      So the guard says no to the shapes an absence actually arrives as. It is
      the arm that would redden the day somebody adds `"none"` or `"unset"` to
      the list to make a `switch` exhaustive.
    */
    for (const absent of [null, undefined, "", "none", "unset", "legacy"]) {
      expect(isCastingPath(absent), String(absent)).toBe(false);
    }
  });

  it("keeps the toggle's default distinct from a stored value", () => {
    /*
      `DEFAULT_CASTING_PATH` is what the CONTROL shows before anyone touches it
      (§6). It is deliberately not a fallback for a stored `null`, and the two
      are named apart so that `?? DEFAULT_CASTING_PATH` at a read site reads as
      the mistake it would be.
    */
    expect(DEFAULT_CASTING_PATH).toBe("wardrobe");
    expect(isCastingPath(DEFAULT_CASTING_PATH)).toBe(true);
  });
});
