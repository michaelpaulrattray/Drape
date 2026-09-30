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
  CREW_FIX_CATEGORY_KEYS,
  homeWorkCategoryFor,
  isFixWork,
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
    actually stop the team rather than requiring him to clear every switch.
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
  it("has the master plus seven categories", () => {
    expect(CREW_WORK_SWITCH_KEYS).toHaveLength(8);
    expect(CREW_WORK_SWITCH_KEYS[0]).toBe(CREW_WORK_MASTER_KEY);
    expect(CREW_WORK_CATEGORIES.map((c) => c.key))
      .toEqual(["bugs", "security", "performance", "housekeeping", "process", "smallFixes", "castingUpkeep"]);
  });

  /*
    ⚠ EVERY CATEGORY'S LABEL MUST BE ONE THE QUEUE ALREADY USES. His card, in
    capitals: the counts and categories are derived from the queue's own labels,
    never a second list. A `queueLabel` invented here would be a category whose
    count is permanently zero and whose cards nobody can file.
  */
  it("every category names a label the seats already use", () => {
    expect(CREW_WORK_CATEGORIES.map((c) => c.queueLabel))
      .toEqual([
        "bug",
        "seat:warden",
        "seat:machinist",
        "seat:janitor",
        "seat:retro",
        "small-fix",
        "casting-upkeep",
      ]);
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

  it("no two categories share a queue label — one card, one row", () => {
    /* Two categories on one label would draw the same cards under two switches
       and give him two answers to one question. The uniqueness arm above covers
       the KEY; this covers the label, which is the half the count reads. */
    const labels = CREW_WORK_CATEGORIES.map((category) => category.queueLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

/*
  ⚠ THE TWO NEW SWITCHES ARE THE POINT OF EACH OTHER (#429).

  His card's own reason for two rather than one: *"Casting is frozen in the
  lobby lane and N1 is gated on his eye; a single 'small fixes' switch would let
  a quiet shift touch the casting road the night he wants it still. Two switches
  let him leave Casting upkeep OFF and Small fixes ON."*

  So the property that matters is not that both exist — it is that they are
  SEPARABLE, in both directions, and that a casting card is reached by exactly
  one of them. `crew-count-queue.mts` derives each row by asking the queue for
  one `queueLabel`, so the categories a card is offered under are exactly the
  categories whose label it carries; that derivation is driven here rather than
  restated, over the real label shapes the eighteen cards carry today.
*/
describe("Small fixes and Casting upkeep are separable, and a casting card reaches only one", () => {
  /** The count's own derivation: which switch rows would offer this card. */
  const offeredUnder = (labels: readonly string[]): string[] =>
    CREW_WORK_CATEGORIES.filter((category) => labels.includes(category.queueLabel)).map((c) => c.key);

  it("⚠ a `casting-upkeep` card is offered under Casting upkeep and NOT under Small fixes", () => {
    /* #242's real shape, and #60's — `debt` and `lost-and-found` ride along and
       neither reaches a switch. */
    expect(offeredUnder(["debt", "casting-upkeep"])).toEqual(["castingUpkeep"]);
    expect(offeredUnder(["lost-and-found", "casting-upkeep"])).toEqual(["castingUpkeep"]);
    /* POSITIVE CONTROL — `smallFixes` is a key this helper CAN return, so the
       absence above is a reading rather than a helper that answers nothing. */
    expect(offeredUnder(["debt", "small-fix"])).toEqual(["smallFixes"]);
  });

  it("either switch runs without the other — his freeze, and its opposite", () => {
    const smallOnly = { [CREW_WORK_MASTER_KEY]: true, smallFixes: true };
    expect(backgroundWorkAllowed(smallOnly, "smallFixes")).toBe(true);
    expect(backgroundWorkAllowed(smallOnly, "castingUpkeep")).toBe(false);

    const castingOnly = { [CREW_WORK_MASTER_KEY]: true, castingUpkeep: true };
    expect(backgroundWorkAllowed(castingOnly, "castingUpkeep")).toBe(true);
    expect(backgroundWorkAllowed(castingOnly, "smallFixes")).toBe(false);
  });

  it("neither is on until he turns it on, whatever else is", () => {
    /* The five that existed before #429 all on, the master on, and the two new
       rows still off — which is what he sees the morning after the deploy. */
    const beforeToday = {
      [CREW_WORK_MASTER_KEY]: true,
      bugs: true,
      security: true,
      performance: true,
      housekeeping: true,
      process: true,
    };
    expect(backgroundWorkAllowed(beforeToday, "smallFixes")).toBe(false);
    expect(backgroundWorkAllowed(beforeToday, "castingUpkeep")).toBe(false);
    /* POSITIVE CONTROL — that store does turn something on. */
    expect(backgroundWorkAllowed(beforeToday, "bugs")).toBe(true);
  });
});

describe("a card is homed in exactly one category (his question, 2026-09-25)", () => {
  it("a single work label homes the card in that category — every category, positively", () => {
    for (const category of CREW_WORK_CATEGORIES) {
      expect(homeWorkCategoryFor(["rung:N2", category.queueLabel, "urgent"])).toBe(category.key);
    }
  });

  it("two work labels home the card ONCE, in the first category of the list — a bug is a bug wherever else it lives", () => {
    /* The two real cases the page had on the day: #1221 bug + casting-upkeep, #1187 bug + small-fix. */
    expect(homeWorkCategoryFor(["casting-upkeep", "bug"])).toBe("bugs");
    expect(homeWorkCategoryFor(["small-fix", "bug"])).toBe("bugs");
    /* And the precedence is the LIST's order, not a second ordering kept here. */
    const [first, second] = CREW_WORK_CATEGORIES;
    expect(homeWorkCategoryFor([second.queueLabel, first.queueLabel])).toBe(first.key);
    expect(homeWorkCategoryFor([second.queueLabel])).toBe(second.key);
  });

  it("no work label homes the card nowhere — the pipeline groups' business, never a category's", () => {
    expect(homeWorkCategoryFor([])).toBeNull();
    expect(homeWorkCategoryFor(["rung:N3", "roadmap", "debt", "founder-ordered"])).toBeNull();
  });
});

/* ── WHICH WORK IS A FIX TO LIVE BEHAVIOUR (#1553) ─────────────────────────── */

describe("a fix to live behaviour is named, and the naming cannot drift from the categories", () => {
  /*
    The seat lane reads this to decide that a `rung:` label on a bug is a
    LOCATOR rather than a hold — three of his own fixes sat unbuildable under the
    milestone gate in one pass because it could not tell the two apart. The rule
    it expresses is `PROGRAM.md`'s MAINTENANCE MODE: bugs and improvements inside
    existing behaviour run when there is no focus at all.
  */
  it("every key it names is a real category, by the compiler and by this reading", () => {
    /*
      `satisfies readonly CrewWorkCategoryKey[]` already makes a renamed category
      a build error. This is the second reader (working law 2): it resolves each
      key against the LIST at runtime, so the set cannot name something the
      declaration stopped having.
    */
    const keys = CREW_WORK_CATEGORIES.map((category) => category.key);
    for (const key of CREW_FIX_CATEGORY_KEYS) {
      expect(keys, `${key} is not a category`).toContain(key);
    }
    expect(CREW_FIX_CATEGORY_KEYS.length).toBeGreaterThan(0);
  });

  it("answers TRUE for exactly the fix categories and FALSE for every other one", () => {
    /*
      Derived over the whole category list rather than named twice, so a new
      category arrives here answering `false` — the fail-closed direction — and a
      category PROMOTED into the fix set has to be promoted in the declaration.
    */
    for (const category of CREW_WORK_CATEGORIES) {
      const expected = (CREW_FIX_CATEGORY_KEYS as readonly string[]).includes(category.key);
      expect(isFixWork([category.queueLabel]), `${category.queueLabel}`).toBe(expected);
      /* A rung label beside it changes nothing — that is the whole point. */
      expect(isFixWork(["rung:N8", category.queueLabel, "urgent"]), `${category.queueLabel} + rung`).toBe(expected);
    }
  });

  it("CAN answer false — the controls that stop this reading from being vacuous", () => {
    /*
      An arm that only ever saw `true` would pass on a predicate that returned
      `true` always. These are the shapes the seat lane must NOT let through: a
      feature card, a patrol card, and a card with no work label at all.
    */
    expect(isFixWork([])).toBe(false);
    expect(isFixWork(["rung:N3"])).toBe(false);
    expect(isFixWork(["design-unbuilt", "rung:N3"])).toBe(false);
    expect(isFixWork(["roadmap", "founder-ordered", "rung:N3"])).toBe(false);
    expect(isFixWork(["casting-upkeep", "rung:N3"])).toBe(false);
    expect(isFixWork(["seat:retro"])).toBe(false);
  });

  it("reads the card's ONE home, so a double-labelled bug is still a fix", () => {
    /*
      His one-work-label rule makes this rare, not impossible. Asking whether ANY
      label is a fix label would be the tempting shape and is wrong for a reason
      worth writing down: it would also answer true for `design-unbuilt` + `bug`,
      which is the mislabelled feature card the seat lane must not take on this
      road. The home is `homeWorkCategoryFor`'s precedence and not a second one.
    */
    expect(isFixWork(["casting-upkeep", "bug"])).toBe(true);
    expect(isFixWork(["seat:retro", "small-fix"])).toBe(false);
    expect(homeWorkCategoryFor(["seat:retro", "small-fix"])).toBe("process");
  });
});
