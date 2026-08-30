/**
 * THE BACKGROUND-WORK SWITCH, DRIVEN DIRECTLY (issue #277,
 * `shared/crewWorkSwitches.ts`).
 *
 * His bar has a direction, and it is the whole test: *"Off by default; an
 * unreadable or missing value reads OFF. … The safe direction is the one where
 * nothing runs."*
 *
 * ⚠ **A TEST THAT ONLY ASSERTS `false` PROVES NOTHING HERE.** Every arm below
 * that expects "not allowed" is paired with one that expects "allowed" from the
 * same function — otherwise a `backgroundWorkAllowed` that had been changed to
 * `return false` would pass the entire fail-safe half of this file. That is the
 * absence-only failure this repository has a memory about, and it is
 * particularly easy to write in a suite whose subject is a default of `false`.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_WORK_CATEGORIES,
  CREW_WORK_MASTER_KEY,
  CREW_WORK_SWITCH_KEYS,
  anyBackgroundWorkAllowed,
  backgroundWorkAllowed,
} from "../shared/crewWorkSwitches";

/** Everything on — the positive control every negative arm is measured against. */
const ALL_ON = Object.fromEntries(CREW_WORK_SWITCH_KEYS.map((key) => [key, true]));

describe("the switch fails toward nothing running", () => {
  /*
    ⚠ THE POSITIVE CONTROL, FIRST AND DELIBERATELY. If this arm ever fails, no
    "not allowed" result below is evidence of anything — the function would be
    refusing for its own reasons rather than because a switch is off.
  */
  it("CONTROL — with everything on, work IS allowed", () => {
    expect(backgroundWorkAllowed(ALL_ON, "bugs")).toBe(true);
    expect(anyBackgroundWorkAllowed(ALL_ON)).toBe(true);
  });

  it("an EMPTY store allows nothing — a fresh install, or a lost row", () => {
    expect(anyBackgroundWorkAllowed({})).toBe(false);
    for (const category of CREW_WORK_CATEGORIES) {
      expect(backgroundWorkAllowed({}, category.key)).toBe(false);
    }
  });

  /*
    THE MASTER IS AN AND, NOT A DEFAULT — this is what makes one tap from bed
    actually stop the team rather than requiring him to clear five switches.
  */
  it("the master off stops everything, however many categories are on", () => {
    const categoriesOn = { ...ALL_ON, [CREW_WORK_MASTER_KEY]: false };
    expect(anyBackgroundWorkAllowed(categoriesOn)).toBe(false);
    for (const category of CREW_WORK_CATEGORIES) {
      expect(backgroundWorkAllowed(categoriesOn, category.key)).toBe(false);
    }
  });

  it("the master ALONE runs nothing — it is a gate, not a switch for everything", () => {
    expect(anyBackgroundWorkAllowed({ [CREW_WORK_MASTER_KEY]: true })).toBe(false);
  });

  it("a category is allowed only when BOTH it and the master are on", () => {
    const onlyBugs = { [CREW_WORK_MASTER_KEY]: true, bugs: true };
    expect(backgroundWorkAllowed(onlyBugs, "bugs")).toBe(true);
    expect(backgroundWorkAllowed(onlyBugs, "security")).toBe(false);
    expect(anyBackgroundWorkAllowed(onlyBugs)).toBe(true);
  });

  /*
    A MISSING KEY IS FALSE, NEVER TRUE. `?? false` rather than `?? true` is the
    single most important character in the module — driven here rather than
    read, because the two spellings are one keystroke apart and only one of them
    is safe.
  */
  it("a key absent from the store is off, not on", () => {
    expect(backgroundWorkAllowed({ [CREW_WORK_MASTER_KEY]: true }, "process")).toBe(false);
  });

  it("a value that is not a boolean cannot turn work on", () => {
    /* A hand-written row, or a driver that hands back 1/0 as a string. */
    const junk = { [CREW_WORK_MASTER_KEY]: "yes", bugs: 1 } as unknown as Record<string, boolean>;
    expect(backgroundWorkAllowed(junk, "bugs")).toBeTruthy();
    /* ⚠ AND THAT IS WHY THE READER COERCES AT THE DATABASE. `Boolean(row.enabled)`
       in `server/db/crewWorkSwitches.ts` and the shift reader is what keeps a
       truthy non-boolean from ever reaching here; this arm records that the
       pure function does NOT defend against it, so nobody deletes that
       coercion believing this file covers it. */
  });
});

describe("the vocabulary is closed and derived from labels that already exist", () => {
  it("has the master plus five categories", () => {
    expect(CREW_WORK_SWITCH_KEYS).toHaveLength(6);
    expect(CREW_WORK_SWITCH_KEYS[0]).toBe(CREW_WORK_MASTER_KEY);
    expect(CREW_WORK_CATEGORIES.map((c) => c.key))
      .toEqual(["bugs", "security", "performance", "housekeeping", "process"]);
  });

  /*
    ⚠ EVERY CATEGORY'S LABEL MUST BE ONE THE QUEUE ALREADY USES. His card, in
    capitals: the counts and categories are derived from the queue's own labels,
    never a second list. A `queueLabel` invented here would be a category whose
    count is permanently zero and whose cards nobody can file.
  */
  it("every category names a label the seats already use", () => {
    expect(CREW_WORK_CATEGORIES.map((c) => c.queueLabel))
      .toEqual(["bug", "seat:warden", "seat:machinist", "seat:janitor", "seat:retro"]);
  });

  it("no category collides with the master key", () => {
    expect(CREW_WORK_CATEGORIES.map((c) => c.key)).not.toContain(CREW_WORK_MASTER_KEY);
  });

  it("every switch key is unique — a duplicate would make the store ambiguous", () => {
    expect(new Set(CREW_WORK_SWITCH_KEYS).size).toBe(CREW_WORK_SWITCH_KEYS.length);
  });

  it("every category carries a blurb, since the panel draws one per row", () => {
    for (const category of CREW_WORK_CATEGORIES) {
      expect(category.blurb.length).toBeGreaterThan(20);
    }
  });
});
