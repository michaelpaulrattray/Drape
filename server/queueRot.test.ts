/**
 * A LABEL IS NOT SOMEBODY LOOKING (#516).
 *
 * The briefing's rot figure read NINE one night and ZERO the next with nobody
 * having re-read a card: the ladder pass applied `rung:*` labels in bulk, and
 * GitHub's `updatedAt` — which every shift's throwaway reader filtered on —
 * moves on any write at all. The founder was told the debt had cleared itself.
 *
 * These arms are all over `scripts/lib/queueRot.mts`, which is a pure function
 * of a timeline and a clock. The fetch is the thin part and is not driven here;
 * what it produced against the REAL queue on the day this landed is in the two
 * fixtures below, and both of them are cards where the old reading and this one
 * disagree — in OPPOSITE directions, which is what makes them a pair rather
 * than two examples of the same thing.
 */
import { describe, expect, it } from "vitest";

import {
  ENGAGEMENT_EVENTS, ENGAGEMENT_FRAGMENTS, ENGAGEMENT_ITEM_TYPES,
  eventsFrom, lastEngagedAt, quietCards, quietSentence, type QueueCard,
} from "../scripts/lib/queueRot.mts";

const NOW = new Date("2026-09-07T08:00:00Z");

const card = (over: Partial<QueueCard> = {}): QueueCard => ({
  number: 1,
  title: "a card",
  createdAt: "2026-08-01T00:00:00Z",
  labels: [],
  events: [],
  ...over,
});

describe("what resets the clock, and what deliberately does not", () => {
  it("⚠ a card whose only recent event is a LABEL is still rotting", () => {
    /* THE INCIDENT ITSELF. Nine cards moved out of the rot figure on a bulk
       relabel; every one of them looked like this. */
    const relabelled = card({
      createdAt: "2026-08-01T00:00:00Z",
      events: [
        { type: "LabeledEvent", at: "2026-09-06T01:34:00Z" },
        { type: "UnlabeledEvent", at: "2026-09-06T07:04:00Z" },
      ],
    });
    expect(lastEngagedAt(relabelled)).toBe("2026-08-01T00:00:00Z");
    expect(quietCards([relabelled], NOW, 7)).toHaveLength(1);
  });

  it("a comment inside the window is engagement — the negative control", () => {
    /*
      Without this arm the whole reading could be "everything is rotting", which
      passes the arm above just as happily and would be useless to him.
    */
    const commented = card({ events: [{ type: "IssueComment", at: "2026-09-05T12:00:00Z" }] });
    expect(quietCards([commented], NOW, 7)).toEqual([]);
  });

  it("a close, a reopen and a commit reference each count too", () => {
    for (const type of ["ClosedEvent", "ReopenedEvent", "ReferencedEvent"]) {
      const engaged = card({ events: [{ type, at: "2026-09-06T12:00:00Z" }] });
      expect(quietCards([engaged], NOW, 7), `${type} did not count as engagement`).toEqual([]);
    }
  });

  it("⚠ a CROSS-REFERENCE does not — and that is the one judgement call in here", () => {
    /*
      Excluding it makes this over-report: a PR that genuinely fixes a card
      cross-references it, so the card can read as rotting on the night its fix
      opens. The other direction is the measured failure — #514 is this
      repository's own case of a PR that CITED cards being read as a PR that
      FIXED them, and the desk sweep cross-references cards on every run.
    */
    const cited = card({ events: [{ type: "CrossReferencedEvent", at: "2026-09-06T12:00:00Z" }] });
    expect(quietCards([cited], NOW, 7)).toHaveLength(1);
  });

  it("a brand-new card with no events at all is NOT rotting", () => {
    /* Creation is the floor. Without it every card filed this morning would sit
       at the top of the list, quiet since the epoch. */
    expect(quietCards([card({ createdAt: "2026-09-06T00:00:00Z" })], NOW, 7)).toEqual([]);
  });

  it("takes the NEWEST engagement, not the last one in the array", () => {
    /* GraphQL returns `last:` in ascending order today. A reading that depended
       on that would break silently the day it changed. */
    const jumbled = card({
      events: [
        { type: "IssueComment", at: "2026-09-06T00:00:00Z" },
        { type: "IssueComment", at: "2026-08-02T00:00:00Z" },
      ],
    });
    expect(lastEngagedAt(jumbled)).toBe("2026-09-06T00:00:00Z");
  });

  it("the window boundary includes the day it names", () => {
    const exactly = card({ events: [{ type: "IssueComment", at: "2026-08-31T08:00:00Z" }] });
    expect(quietCards([exactly], NOW, 7)).toHaveLength(1);
    const oneHourShort = card({ events: [{ type: "IssueComment", at: "2026-08-31T09:00:00Z" }] });
    expect(quietCards([oneHourShort], NOW, 7)).toEqual([]);
  });

  it("reports quietest first, so the line he reads leads with the worst", () => {
    const readings = quietCards([
      card({ number: 2, createdAt: "2026-08-20T00:00:00Z" }),
      card({ number: 3, createdAt: "2026-08-01T00:00:00Z" }),
    ], NOW, 7);
    expect(readings.map((reading) => reading.card.number)).toEqual([3, 2]);
  });
});

describe("the two real cards where the readings disagree — in opposite directions", () => {
  /*
    ⚠ FIXTURES, READ FROM THE LIVE REPOSITORY ON 2026-09-07 and quoted here with
    their timestamps. They are a PAIR on purpose: one card the old reading calls
    FRESH and this one calls rotting, and one it calls ROTTING that this one
    clears. A single specimen could only ever have proven the reading moves.
  */

  it("#14 — `updatedAt` says fresh, and the only recent events are labels", () => {
    /* Its timeline, per #516: `labeled roadmap` 01:34, `labeled rung:N3` 05:14,
       cross-referenced 07:25 — not one of them a person reading the card. */
    const fourteen = card({
      number: 14,
      createdAt: "2026-08-25T00:00:00Z",
      events: [
        { type: "LabeledEvent", at: "2026-09-04T01:34:00Z" },
        { type: "LabeledEvent", at: "2026-09-04T05:14:00Z" },
        { type: "CrossReferencedEvent", at: "2026-09-04T07:25:00Z" },
        { type: "IssueComment", at: "2026-08-27T00:00:00Z" },
      ],
    });
    expect(quietCards([fourteen], NOW, 7)).toHaveLength(1);
  });

  it("#257 — `updatedAt` says rotting, and a commit referenced it two days ago", () => {
    /*
      Read live: `createdAt` and `updatedAt` are BOTH 2026-08-29T23:21:47Z — a
      referenced event does not move `updatedAt` at all — while the timeline
      carries two `ReferencedEvent`s on 2026-09-05. The previous shift reported
      it as the single rotting card in the queue; a commit had touched it.
    */
    const twoFiveSeven = card({
      number: 257,
      createdAt: "2026-08-29T23:21:47Z",
      events: [
        { type: "ReferencedEvent", at: "2026-09-05T17:32:33Z" },
        { type: "ReferencedEvent", at: "2026-09-05T21:41:28Z" },
      ],
    });
    expect(quietCards([twoFiveSeven], NOW, 7)).toEqual([]);
  });
});

describe("the sentence names what was measured", () => {
  it("never says `untouched` — that is the word the incident made false", () => {
    expect(quietSentence(15, 7)).not.toContain("untouched");
    expect(quietSentence(0, 7)).not.toContain("untouched");
  });

  it("says which signals would have reset the clock", () => {
    const sentence = quietSentence(15, 7);
    expect(sentence).toContain("comment");
    expect(sentence).toContain("commit");
    expect(sentence).toContain("7 days");
    expect(sentence).toContain("15");
  });

  it("reads as English at one, at none, and at many", () => {
    expect(quietSentence(1, 7)).toContain("1 open card has");
    expect(quietSentence(2, 7)).toContain("2 open cards have");
    expect(quietSentence(0, 7)).toContain("no open card");
  });
});

describe("the three spellings of one event list stay one list", () => {
  /*
    Working law 4, and the drift here would be SILENT. GitHub spells the same
    event `ISSUE_COMMENT` in `itemTypes` and `IssueComment` in `__typename`, and
    a query needs an inline fragment per kind to reach `createdAt`. A kind asked
    for but missing its fragment comes back undated — so a card commented on
    yesterday would read as never engaged with, and nothing would look wrong.
  */
  it("every kind is in all three views, and none is in only two", () => {
    expect(ENGAGEMENT_ITEM_TYPES).toHaveLength(ENGAGEMENT_EVENTS.length);
    for (const typename of ENGAGEMENT_EVENTS) {
      expect(ENGAGEMENT_FRAGMENTS, `${typename} has no fragment`).toContain(`... on ${typename} { createdAt }`);
    }
    expect(ENGAGEMENT_FRAGMENTS.match(/\.\.\. on /g) ?? []).toHaveLength(ENGAGEMENT_EVENTS.length);
  });

  it("the item types are the SCREAMING_CASE of the typenames", () => {
    for (const [index, typename] of ENGAGEMENT_EVENTS.entries()) {
      const screaming = typename.replace(/(?<!^)([A-Z])/g, "_$1").toUpperCase();
      expect(ENGAGEMENT_ITEM_TYPES[index]).toBe(screaming);
    }
  });

  it("the list is not empty — a derived view over nothing agrees with everything", () => {
    expect(ENGAGEMENT_EVENTS.length).toBeGreaterThan(3);
  });
});

describe("a timeline node this reader cannot date is dropped, never dated NaN", () => {
  it("keeps the ones it can read and drops the ones it cannot", () => {
    /*
      `Date.parse(undefined)` is NaN and every comparison against NaN is false,
      so an undated event would quietly REMOVE a card from the reading — the
      hiding direction, which is the whole defect this card is about.
    */
    expect(eventsFrom([
      { __typename: "IssueComment", createdAt: "2026-09-06T00:00:00Z" },
      { __typename: "SomeEventWithNoFragment" },
      {},
      { createdAt: "2026-09-06T00:00:00Z" },
    ])).toEqual([{ type: "IssueComment", at: "2026-09-06T00:00:00Z" }]);
  });

  it("a card whose ONLY event is undated falls back to its creation", () => {
    const undated = card({
      createdAt: "2026-08-01T00:00:00Z",
      events: eventsFrom([{ __typename: "IssueComment" }]),
    });
    expect(lastEngagedAt(undated)).toBe("2026-08-01T00:00:00Z");
    expect(quietCards([undated], NOW, 7)).toHaveLength(1);
  });
});
