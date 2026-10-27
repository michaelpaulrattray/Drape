/**
 * AN OVER-LONG VALUE NAMES ITS OWN REFUSAL — #2714.
 *
 * # The defect this guard holds shut
 *
 * One value longer than the drawer it files into used to return the whole-delta
 * `null` with NO wall set. That falls out of the interpreter's three samplings
 * as `unreadable`, whose sentence is *"That one didn't come through clearly.
 * Try naming what you want changed about them."* Three things were wrong with
 * that, and this file has an arm for each:
 *
 *   1. **The sentence was false.** The ask came through perfectly clearly — it
 *      was read, understood, and every content word passed containment. It was
 *      discarded over a storage limit, and the advice *try naming what you want
 *      changed* is unfollowable by somebody who just did.
 *   2. **It took the rest of the sentence with it.** The over-long value never
 *      dropped its own key; it dropped the delta. Every unrelated change in the
 *      same instruction died silently beside it.
 *   3. **It bought three real model samplings** on the way to a refusal the
 *      FIRST parse already knew about — house money spent to reach a worse
 *      answer.
 *
 * # What is deliberately NOT fixed, and is asserted as kept
 *
 * **The all-or-nothing storage rule stays.** Dropping the over-long key and
 * keeping its neighbours is #2552's rejected option (a), and this card re-made
 * the argument: silently discarding one change the customer stated is harder to
 * notice than losing all of them. So the delta still nulls — what changed is
 * that the refusal is now true, actionable, and reached without re-sampling.
 * The arm below asserts the null and the named wall TOGETHER, so a later shift
 * that "fixes" this into a partial file reddens here rather than shipping.
 *
 * **And the caps themselves are not touched.** #2714's own body: *do not fix
 * this by widening caps. A cap that is too small is #2552's class; this card is
 * about what happens at whatever the cap turns out to be.*
 */
import { describe, expect, it } from "vitest";

import type { TextEngine, TextRequest } from "../providers/types";
import { interpretRefinement, refusalMessage } from "./refineInterpreter";
import { REFINE_REFUSALS } from "./refineRefusals";
import { refusalIsAnswerableByAReader } from "./referenceWordsLane";
import {
  readDelta, freeSubjectMaxLength, MAX_MAKEUP_LENGTH, type FreeLaneCheck,
} from "./refineDelta";

const check = (instruction: string): FreeLaneCheck => ({ instruction });

/**
 * An engine that records every request and replies from a script — the
 * `refineInterpreterCeiling` harness, which is where counting samplings is
 * already done honestly.
 */
function scripted(replies: string[]): TextEngine & { seen: TextRequest[] } {
  const seen: TextRequest[] = [];
  let index = 0;
  return {
    id: "scripted",
    seen,
    async complete(request: TextRequest) {
      seen.push(request);
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return {
        text: reply!,
        provenance: { provider: "openrouter" as const, model: "scripted" },
        latencyMs: 0,
      } as Awaited<ReturnType<TextEngine["complete"]>>;
    },
  };
}

describe("an over-long value is refused by name, not as an unreadable sentence (#2714)", () => {
  /*
    THE NUMBER IS WRITTEN OUT, and that is deliberate rather than untidy — it is
    `refineDelta.test`'s own lesson one table along. An arm that probes at
    `freeSubjectMaxLength(subject) + 1` moves WITH the cap, so a cap sabotaged
    to 100000 would leave every arm here passing. 120 is `MAX_FREE_LENGTH`; a
    shift that means to move it moves this line too, on purpose.
  */
  const CAP = 120;

  it("pins the cap this file probes at", () => {
    expect(freeSubjectMaxLength("marks")).toBe(CAP);
    expect(freeSubjectMaxLength("brows")).toBe(CAP);
  });

  it("names the wall, and carries the subject and the numbers for the log", () => {
    const over = "freckled ".repeat(20).trim();
    expect(over.length).toBeGreaterThan(CAP);

    const state = check(over);
    expect(readDelta({ free: { marks: over } }, state), "the delta still nulls").toBeNull();

    expect(state.wall?.reason, "the refusal is named rather than left to re-sampling")
      .toBe("wall_too_long");
    expect(state.wall && "asked" in state.wall && state.wall.asked).toBe("marks");
    expect(state.wall && "length" in state.wall && state.wall.length).toBe(over.length);
    expect(state.wall && "limit" in state.wall && state.wall.limit).toBe(CAP);
  });

  it("⚠ THE HALF NOBODY SAW — the unrelated change still dies, and now the customer is TOLD", () => {
    /*
      The card's own measurement, reproduced: a value over its cap asked
      alongside an ordinary one well inside its own. Before this, BOTH were lost
      and the sentence blamed the customer's English. The loss is kept on
      purpose (the all-or-nothing rule); the silence is what ends.
    */
    const over = "freckled ".repeat(20).trim();
    const ordinary = "thick and straight";

    const together = check(`${over} and ${ordinary} brows`);
    expect(readDelta({ free: { marks: over, brows: ordinary } }, together)).toBeNull();
    expect(together.wall?.reason).toBe("wall_too_long");

    /* THE POSITIVE CONTROL. The same ordinary ask, on its own, files — so the
       arm above is measuring the over-long value and not a broken reader. */
    const alone = check(`${ordinary} brows`);
    expect(readDelta({ free: { brows: ordinary } }, alone)?.free?.brows).toBe(ordinary);
    expect(alone.wall, "nothing walls on the ask that fits").toBeUndefined();
  });

  it("CONTROL — a value AT the cap files and walls nothing", () => {
    /*
      The boundary from the other side. Without this, "the over-long value
      walls" is satisfied by a reader that walls everything.
    */
    const atTheCap = "freckled ".repeat(20).trim().slice(0, CAP);
    expect(atTheCap.length, "cut to the cap exactly, not to an arithmetic guess").toBe(CAP);

    const state = check(atTheCap);
    expect(readDelta({ free: { marks: atTheCap } }, state)?.free?.marks).toEqual([atTheCap]);
    expect(state.wall).toBeUndefined();
  });

  it("⚠ THE READER SPLIT HOLDS — a caller with no `check` is byte-unchanged", () => {
    /*
      With no `check` in hand this is our own record re-entering
      (`refineService`'s persisted re-read, `refineLegacy`, the paste road),
      where an unstorable value is corruption rather than an ask and there is
      nobody to tell. It must still null, and it must not throw reaching for a
      `check` that is not there — which is the one way this change could have
      broken a road it was never about.
    */
    const over = "freckled ".repeat(20).trim();
    expect(readDelta({ free: { marks: over } })).toBeNull();
    expect(() => readDelta({ free: { marks: over } })).not.toThrow();
  });

  it("⚠ NOT THIS WALL — a value the brand scrub empties keeps the old road, and that is a FILED sibling", () => {
    /*
      The two halves of this condition used to be one line, and splitting them
      is what let the length case speak. The OTHER half — nothing survived the
      brand scrub — is the same class (a storage-shape refusal nulling the delta
      with no wall) and is a DIFFERENT fact needing a DIFFERENT sentence, so it
      is **#2731** rather than folded in here, on his 2026-09-24 rule. Driven
      with its controls before it was filed: a brand-only value nulls the whole
      delta on `marks`, `wardrobe` AND `makeup`, names no wall, and takes an
      ordinary brows ask down with it.

      This arm pins that it did NOT quietly inherit the length sentence: a
      brand-only value must not tell somebody to say it in fewer words. It is
      the negative control on the split itself.
    */
    const state = check("put her in Gucci");
    expect(readDelta({ free: { marks: "Gucci" } }, state)).toBeNull();
    expect(state.wall?.reason, "a brand-only value is not a length problem")
      .not.toBe("wall_too_long");
  });
});

describe("⚠ LAW 7's SWEEP — the class had TWO instances in one function (#2714)", () => {
  /*
    `makeup` is the one free-text slot with no enum behind it, and its cap sat
    140 lines above the free lane's in the same reader, in the same shape:
    `!cleaned || cleaned.length > MAX_MAKEUP_LENGTH` → the whole delta nulls,
    no wall, "didn't come through clearly". Fixing one and not the other is the
    instance fixed and the class left open, so it moved in the same commit.

    ⚠ TWO further siblings are DIFFERENT facts needing DIFFERENT sentences, so
    each is FILED rather than folded in here (his 2026-09-24 rule), and each was
    DRIVEN with its controls before it was filed:

      * **#2730** — too MANY items under one subject. Nine marks in one
        sentence, each well inside its own cap, return the whole-delta `null`
        with no wall; the same sentence with eight files every one of them.
      * **#2731** — the brand scrub emptying a value, which is the other half of
        the condition this card split. A brand-only value nulls the whole delta
        on `marks`, `wardrobe` and `makeup`, names no wall, and takes an
        ordinary brows ask down with it. The arm below pins that it did not
        inherit this card's sentence.

    ⚠ **AND A SECOND ONE WAS CLAIMED, DRIVEN, AND DOES NOT EXIST — written here
    because the next sweep will otherwise re-find it.** The `absent` (removal)
    lane looked like it dropped an over-long item SILENTLY and kept the rest: it
    builds `items` with a `.filter()` on the per-subject cap. The line
    immediately below that filter is `if (items.length !== value.length) return
    null;`, so nothing is dropped — and the lane refuses outright when a `check`
    is in hand (`if (check) return null`), because a model reply carrying
    `absent` has invented an authority it was never given. So it is unreachable
    from a reply at all, and on our own record re-entering it nulls, which is
    corruption with nobody to tell. The reading that produced the false claim
    stopped at the `.filter()`.
  */
  it("the makeup slot's cap names the same wall, with its own subject and numbers", () => {
    const over = "smoky ".repeat(40).trim();
    expect(over.length).toBeGreaterThan(MAX_MAKEUP_LENGTH);

    const state = check(over);
    expect(readDelta({ makeup: over }, state)).toBeNull();
    expect(state.wall?.reason).toBe("wall_too_long");
    expect(state.wall && "asked" in state.wall && state.wall.asked).toBe("makeup");
    expect(state.wall && "limit" in state.wall && state.wall.limit).toBe(MAX_MAKEUP_LENGTH);
  });

  it("CONTROL — an ordinary makeup ask still files, and walls nothing", () => {
    const ordinary = "a soft smoky eye";
    const state = check(ordinary);
    expect(readDelta({ makeup: ordinary }, state)?.makeup).toBe(ordinary);
    expect(state.wall).toBeUndefined();
  });

  it("CONTROL — an EMPTIED makeup value keeps its own road, exactly as the free lane's does", () => {
    /* The split again, on the second instance: a brand-only value must not
       inherit a sentence telling somebody to be briefer. */
    const state = check("give her Gucci makeup");
    expect(readDelta({ makeup: "Gucci" }, state)).toBeNull();
    expect(state.wall?.reason).not.toBe("wall_too_long");
  });
});

describe("what the customer reads, and what it costs (#2714)", () => {
  const entry = REFINE_REFUSALS.wall_too_long;

  it("is free and reports as a wall, not as an unread sentence", () => {
    expect(entry.charge).toBe("free");
    /*
      THE REPORT CLASS MOVED, and it is a correctness fix in the reliability
      report rather than bookkeeping. This case used to be counted under
      `unreadable`, whose class is `unread` — a sentence that did not come
      through. It DID come through. `wall` is what the report means by the
      product declining something, which is what happened.
    */
    expect(entry.report).toBe("wall");
    expect(REFINE_REFUSALS.unreadable.report, "the id it used to arrive under").toBe("unread");
  });

  it("says it was understood, says the rest is not lost, and says nothing was charged", () => {
    const said = refusalMessage({ ok: false, refusal: { reason: "wall_too_long", asked: "marks" } });

    expect(said).toContain("I understood that");
    expect(said).toContain("fewer words");
    expect(said).toContain("the rest of your sentence");
    expect(said).toContain("Nothing was charged.");
  });

  it("⚠ AND IT NEVER SAYS THE FALSE THING, NOR A NUMBER NOBODY CAN ACT ON", () => {
    const said = refusalMessage({
      ok: false,
      refusal: { reason: "wall_too_long", asked: "marks", length: 187, limit: 120 },
    });

    /* The sentence this card exists to stop saying. */
    expect(said).not.toContain("didn't come through clearly");
    expect(said).not.toContain("come through");

    /*
      THE DISAPPEARING-TECHNOLOGY LAW'S CLAUSE 6, as an assertion rather than a
      review note: a character count is the worked example of a number a
      customer has no basis to act on. The refusal CARRIES both numbers — they
      were in the refusal handed in above — and the sentence must leak neither,
      nor any other digit.
    */
    expect(said, "no digits reach the customer").not.toMatch(/\d/);

    /* And it must not offer a retry that cannot work: nothing changes on its
       own here, so "try again in a moment" would be a dead-end offer. */
    expect(said).not.toContain("in a moment");
  });

  it("keeps the reader road this case already had", () => {
    /*
      ⚠ THE WHAT-WAS-BOLTED-TO-IT SWEEP. Until this card an over-long value
      arrived as `unreadable`, which IS answerable by a picture reader — so a
      words-take sentence with a reference attached has always reached one here.
      The id moved, so the list keyed on the id had to be asked. Dropping the
      new name would have closed that road silently while reading as a copy
      change.
    */
    expect(refusalIsAnswerableByAReader("wall_too_long")).toBe(true);
    expect(refusalIsAnswerableByAReader("unreadable"), "the road it inherits").toBe(true);
    /* The control: the list is still closed, not switched off. */
    expect(refusalIsAnswerableByAReader("wall_content")).toBe(false);
  });
});

describe("it is reached on the FIRST parse, which is the house-money half (#2714)", () => {
  it("refuses on ONE sampling where it used to buy three", async () => {
    /*
      THE ARM THAT MEASURES THE SPEND. `containReply` checks `check.wall` before
      anything else — *a wall is an answer, not a hiccup; it must not be
      re-sampled* — so a named wall ends the read immediately. With no wall set
      the reader returned a bare `null`, which is indistinguishable from an
      unusable reply, and the loop sampled twice more at full price.

      Every content word of the value is in the instruction, so the reply clears
      containment and really does reach the cap check, rather than failing one
      guard earlier for a reason this arm would misread as its own.
    */
    const over = "freckled ".repeat(20).trim();
    expect(over.length).toBeGreaterThan(freeSubjectMaxLength("marks"));

    const engine = scripted([JSON.stringify({ intent: "edit", free: { marks: over } })]);
    const parsed = await interpretRefinement({
      instruction: over,
      currentEyeColour: "brown",
      currentEyeShape: null,
      engine,
    });

    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.refusal.reason).toBe("wall_too_long");
    expect(engine.seen.length, "one reading, not three").toBe(1);
  });
});
