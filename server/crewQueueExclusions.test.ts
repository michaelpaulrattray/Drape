/**
 * WHAT THE SWITCH COUNT LEAVES OUT — the vocabulary, the partition and the
 * sentence (#324).
 *
 * Founder, 2026-08-31, at the live panel: *"it says 13 bugs etc where do these
 * bugs come from how are they calculated etc? how do we know they are not
 * already scheduled to be fixed in current pipeline or work?"*
 *
 * ⚠ **THE ARMS THAT MATTER ARE THE TWO DIRECTIONS OF WRONGNESS**, because this
 * module's whole job is a number the founder cannot verify by eye:
 *
 *   * TOWARD SILENCE — an exclusion that happens and is not SAID. That is the
 *     failure his card names by name, and it is worse than not excluding at
 *     all: a count that quietly shrinks is indistinguishable from a broken
 *     counter, on the panel that exists because he could not tell those apart.
 *   * TOWARD ARITHMETIC HE CANNOT REPRODUCE — a card counted under two reasons,
 *     so the exclusions sum to more than the cards they came from.
 *
 * Every parse arm carries a POSITIVE CONTROL beside it: `{}` is the answer to
 * every malformed input, so an arm asserting `{}` proves nothing unless the
 * same shape with one field corrected proves the reader could have said yes.
 */
import { describe, expect, it } from "vitest";

import {
  QUEUE_EXCLUSION_REASONS,
  exclusionFor,
  parseQueueExclusions,
  queueExclusionSentence,
  serializeQueueExclusions,
} from "../shared/crewQueueExclusions";

describe("the exclusion vocabulary", () => {
  it("⚠ CONTROL — the reasons are the queue's OWN labels, not labels invented here", () => {
    /* `shared/crewWorkSwitches.ts`'s anti-drift design, one level out: a card
       relabelled in GitHub must move between offered and excluded with nobody
       touching this file. Both labels below were already in use — the relay
       applies `founder-ordered`, `parked` is on six open cards today, and
       `blocked` is written by `crew-desk-sweep.mts` on every shift close.

       ⚠ **THIS ARM WENT RED WHEN `blocked` WAS ADDED, AND THAT IS ITS JOB.**
       It is the only thing standing between the vocabulary and a reason added
       quietly, so the repair is to state the new list here with its reasoning
       — never to loosen the assertion to a length or a `toContain`. */
    expect(QUEUE_EXCLUSION_REASONS.map((reason) => reason.queueLabel))
      .toEqual(["founder-ordered", "parked", "blocked"]);
  });

  it("names a card he has already queued", () => {
    expect(exclusionFor(["bug", "founder-ordered"])).toBe("ordered");
  });

  it("names a card parked on his own ruling", () => {
    expect(exclusionFor(["debt", "parked"])).toBe("parked");
  });

  it("names a card waiting on him or on another card", () => {
    /* The live shape the card was filed about: `#513` carries a Process seat
       and `blocked`, so the row said five when four could be worked. */
    expect(exclusionFor(["seat:retro", "blocked"])).toBe("blocked");
  });

  it("⚠ `parked` outranks `blocked`, and `ordered` outranks both", () => {
    /* First match wins, so the ORDER of the array is what his page says about a
       card carrying two of them. His own act is the more useful fact: a card he
       parked reads as parked, not as waiting. No open card carries both today —
       the order is written down before it is needed, not after. */
    expect(exclusionFor(["parked", "blocked"])).toBe("parked");
    expect(exclusionFor(["founder-ordered", "blocked"])).toBe("ordered");
  });

  it("⚠ a card carrying BOTH labels is counted ONCE, as ordered", () => {
    /* Toward-arithmetic-he-cannot-reproduce. If both matched, a category's
       exclusions could sum past its own population — a subtraction printed on
       his page that nobody could redo from the queue. `ordered` wins because
       what he needs to know about such a card is that HE queued it. */
    expect(exclusionFor(["parked", "founder-ordered"])).toBe("ordered");
  });

  it("⚠ POSITIVE CONTROL — an ordinary card is NOT excluded", () => {
    /* Without this, every arm above passes for a function that returns a
       reason for everything, which would empty his panel. */
    expect(exclusionFor(["bug", "seat:retro", "urgent"])).toBeNull();
    expect(exclusionFor([])).toBeNull();
  });
});

describe("the stored value", () => {
  it("round-trips the reasons that took something out", () => {
    const stored = serializeQueueExclusions({ ordered: 2, parked: 1, blocked: 1 });
    expect(parseQueueExclusions(stored)).toEqual({ ordered: 2, parked: 1, blocked: 1 });
  });

  it("⚠ a row stored BEFORE the new reason existed still reads, missing that key", () => {
    /* No migration rides with this change, so every `crew_queue_counts` row on
       production was written by a counter that had never heard of `blocked`.
       Those rows must keep reading as what they are — a count with two reasons
       in it — until the next shift's counter rewrites them, which happens at
       every shift start. */
    expect(parseQueueExclusions('{"ordered":2,"parked":1}')).toEqual({ ordered: 2, parked: 1 });
  });

  it("drops a reason that excluded nothing rather than storing a zero", () => {
    expect(parseQueueExclusions(serializeQueueExclusions({ ordered: 2, parked: 0 })))
      .toEqual({ ordered: 2 });
  });

  it("⚠ every malformed value reads as NO exclusions, never as a throw", () => {
    /* His ENTIRE Crew tab is one `crew.getState` call, so a throw in this
       projection is a blank page for the founder. Degrading to `{}` draws the
       count alone — a state he has already seen and understood. */
    for (const bad of [null, undefined, "", "   ", "{", "[]", '["ordered"]', "7", '{"ordered":"2"}',
      '{"ordered":-3}', '{"ordered":1.5}', '{"invented":4}']) {
      expect(parseQueueExclusions(bad), `${String(bad)} should read as no exclusions`).toEqual({});
    }
  });

  it("⚠ POSITIVE CONTROL — the reader CAN say yes to the same shape corrected", () => {
    /* Without this the arm above passes for a parser that returns `{}` for
       everything, which is exactly the silent-exclusion failure. */
    expect(parseQueueExclusions('{"ordered":2}')).toEqual({ ordered: 2 });
  });
});

describe("the sentence the panel says", () => {
  it("⚠ says the exclusion out loud — the failure his card names is the SILENT one", () => {
    expect(queueExclusionSentence({ ordered: 2 })).toBe("2 already queued");
  });

  it("says both, in the vocabulary's order", () => {
    expect(queueExclusionSentence({ parked: 1, ordered: 2 })).toBe("2 already queued, 1 parked");
  });

  it("⚠ the true sentence for the Process row that read five when four were takeable", () => {
    /* `Process (4 on offer, 1 blocked)`. The count was not broken — it was
       honest about the label and wrong about the product, which is the same
       shape as the Security row below and the opposite sign. */
    expect(queueExclusionSentence({ blocked: 1 })).toBe("1 blocked");
  });

  it("says all three in the vocabulary's order, never the caller's", () => {
    /* The keys are handed over deliberately shuffled: the sentence must follow
       the array, or two categories could read their exclusions in different
       orders on one page. */
    expect(queueExclusionSentence({ blocked: 1, parked: 3, ordered: 2 }))
      .toBe("2 already queued, 3 parked, 1 blocked");
  });

  it("⚠ says NOTHING for the ordinary row, so `Process (12)` is unchanged", () => {
    /* `null` rather than `""`: the panel appends `, ${sentence}` and an empty
       string would draw a stray comma inside the parenthesis on every row that
       excluded nothing — which is most of them. */
    expect(queueExclusionSentence({})).toBeNull();
    expect(queueExclusionSentence({ ordered: 0 })).toBeNull();
  });

  it("⚠ the true sentence for a Security row whose only card is parked", () => {
    /* `Security (0), 1 parked`. `(0)` on a security row is the single most
       reassuring number on the page, and "nothing is queued" must not look
       identical to "nothing exists" on that row of all rows. */
    expect(queueExclusionSentence({ parked: 1 })).toBe("1 parked");
  });
});
