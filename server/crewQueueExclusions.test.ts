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
  WORK_HOLDING_REASONS,
  exclusionFor,
  parseQueueExclusions,
  queueExclusionSentence,
  serializeQueueExclusions,
  workHoldExclusionFor,
} from "../shared/crewQueueExclusions";
import { CREW_NOT_BUILT_LABEL } from "../shared/crewCardBuildState";
import { CREW_HOLD_LABELS } from "../shared/crewNextUpHold";

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
      .toEqual(["research", null, "founder-ordered", "parked", "blocked", "awaiting-fable", "needs-sitting", "not-built"]);
    /* ⚠ AND IT WENT RED A SIXTH TIME FOR #2231, WHICH ADDED `not-built` AT THE
       END — the first row that does NOT mean *nobody may work this*. His ruling
       (Crew reply #237, option A) leaves a refused card on offer, and the row
       exists only so the NUMBER under his switches stops calling declined work
       fresh: `#2198` kept Bugs off zero, the park gate could not park, and the
       card was re-offered every pass until a seat applied `blocked` by hand.
       **It is LAST, and that is correctness rather than tidiness** — the row is
       invisible to the cut, so above a work-holding row it would hand the cut
       the word *refused* for a parked card and the cut would then offer it. The
       arms for both halves are in this file and in `server/seatBatches.test.ts`.
       The LITERAL is written here rather than `CREW_NOT_BUILT_LABEL`, for the
       `research` reason three lines down: this arm pins the spelling GitHub
       actually carries. */
    /* ⚠ AND IT WENT RED A FIFTH TIME FOR #1548, WHICH ADDED `research` AT THE
       FRONT — and it is the queue's own label like the rest: the relay applies it
       to his research team's proposals (#1465, #1535 carry it today, both alone).
       It is FIRST because it is the one row that says the card is not work at
       all, where every other row says real work is not offered right now. The
       LITERAL is written here rather than `RESEARCH_LABEL`, deliberately: this
       arm pins the spelling GitHub actually carries, and deriving it would let a
       typo in the constant pass. */
    /* ⚠ AND IT WENT RED A THIRD TIME FOR #1094, WHICH ADDED THE FIRST ROW — the
       `null` is the point of it. `building` is the one reason that is NOT a
       label: nobody labels a card "somebody is building this", and the fact is an
       open pull request or a `CLAIMED —` comment, read by
       `shared/crewCardBuildState.ts`. His order of 2026-09-26 is on the row. */
    /* ⚠ AND IT WENT RED AGAIN FOR #999, WHICH ADDED THE LAST TWO. Neither is new:
       both are `shared/crewNextUpHold.ts`'s hold labels, which the relay and the
       desk sweep already apply. `#841` carried `awaiting-fable` under a switch
       and was counted as on offer, so the park gate saw work no shift may take. */
  });

  it("⚠ #999 — EVERY hold label has an exclusion row, read from the one hold vocabulary", () => {
    /* The drift this arm closes: `blocked` was typed here while the hold
       vocabulary grew two more labels, and nothing noticed that a held card
       was still being offered. A fourth hold label added there reddens this. */
    const excluded = QUEUE_EXCLUSION_REASONS
      /* The label-less row (#1094's `building`) cannot carry a hold label and is
         not what this arm is about — it is dropped rather than compared, so a
         `null` in the list cannot make a missing hold label look present. */
      .flatMap((reason) => (reason.queueLabel === null ? [] : [reason.queueLabel]));
    for (const label of Object.values(CREW_HOLD_LABELS)) {
      expect(excluded, `hold label \`${label}\` has no exclusion row`).toContain(label);
    }
  });

  it("⚠ #2231 — EVERY hold label's row HOLDS WORK OFF, so a hold can never become count-only", () => {
    /* The drift this closes is the one #2231 opened the door to: the moment a
       row can say `holdsOffWork: false`, a hold label landing on a count-only
       row would be subtracted from his number AND handed to a seat. Derived
       from the hold vocabulary, so a fourth hold label reddens this too. */
    for (const label of Object.values(CREW_HOLD_LABELS)) {
      const row = QUEUE_EXCLUSION_REASONS.find((reason) => reason.queueLabel === label);
      expect(row, `hold label \`${label}\` has no exclusion row`).toBeDefined();
      expect(row!.holdsOffWork, `hold label \`${label}\` must hold work off a seat`).toBe(true);
    }
  });

  it("⚠ #2231 — the work-holding subset is DERIVED, and `refused` is the only row outside it", () => {
    /* Both directions, because the interesting failure is a row drifting INTO
       the subset as much as out of it. The count-only keys are named here so an
       eighth row answering `false` is a deliberate act with an arm to update,
       never something that reaches the park gate unnoticed. */
    expect(WORK_HOLDING_REASONS.map((reason) => reason.key))
      .toEqual(["research", "building", "ordered", "parked", "blocked", "fable", "sitting"]);
    expect(QUEUE_EXCLUSION_REASONS.filter((reason) => !reason.holdsOffWork).map((reason) => reason.key))
      .toEqual(["refused"]);
    /* A count-only row placed above a work-holding one is the ordering hazard
       `refused`'s own block names: it must stay last. */
    expect(QUEUE_EXCLUSION_REASONS.at(-1)!.holdsOffWork).toBe(false);
  });

  it("⚠ #2231 — a refusal leaves the COUNT and stays on offer to a seat", () => {
    /* The live specimen at the fix, read at `gh issue list` 2026-10-11: `#1736`
       carries `bug` + `not-built` and was the whole of *Bugs — 1 on offer*. */
    expect(exclusionFor(["bug", CREW_NOT_BUILT_LABEL])).toBe("refused");
    expect(queueExclusionSentence({ refused: 1 })).toBe("1 refused");
    /* ⚠ THE HALF HIS RULING IS ABOUT, AND IT IS THE POINT OF THE WHOLE CHANGE:
       the cut's reader says nothing about a refusal, so the card is still
       handed to a seat that wants to overturn the reading. */
    expect(workHoldExclusionFor(["bug", CREW_NOT_BUILT_LABEL])).toBeNull();
  });

  it("⚠ #2231 — a refusal beside a real hold answers with the HOLD, in both readers", () => {
    /* `#2198`'s own shape at the fix: `bug` + `blocked` + `not-built`, the card
       a seat stopped by hand. If the count answered *refused* here, his panel
       would say a blocked card had merely been declined; if the CUT answered
       `null`, it would offer a blocked card — which is the failure the ordering
       and the derived subset each close independently. */
    expect(exclusionFor(["bug", "blocked", CREW_NOT_BUILT_LABEL])).toBe("blocked");
    expect(workHoldExclusionFor(["bug", "blocked", CREW_NOT_BUILT_LABEL])).toBe("blocked");
    expect(exclusionFor(["bug", "parked", CREW_NOT_BUILT_LABEL])).toBe("parked");
    expect(workHoldExclusionFor(["bug", "parked", CREW_NOT_BUILT_LABEL])).toBe("parked");
    /* And `beingBuilt` reaches the subset the same way it reaches the whole
       vocabulary — the label-less row is in both populations, so the one walker
       cannot have two contracts. */
    expect(workHoldExclusionFor(["bug"], true)).toBe("building");
    expect(workHoldExclusionFor(["bug"], false)).toBeNull();
  });

  it("names a card held for a Fable session, or for a sitting", () => {
    /* The live shape the card was filed about: `#841`. */
    expect(exclusionFor(["debt", "seat:janitor", "awaiting-fable"])).toBe("fable");
    expect(exclusionFor(["seat:retro", "needs-sitting"])).toBe("sitting");
    /* A card that is both blocked and awaiting Fable reads as blocked — first
       match wins, and a Fable session could not take it either. */
    expect(exclusionFor(["awaiting-fable", "blocked"])).toBe("blocked");
    expect(queueExclusionSentence({ fable: 1, parked: 3 })).toBe("3 parked, 1 awaiting Fable");
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
