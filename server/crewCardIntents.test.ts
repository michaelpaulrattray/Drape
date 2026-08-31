/**
 * HIS "NOT RELEVANT" TAP — the rules, driven (issue #325's second half).
 *
 * Everything here is pure: the vocabulary, what the panel says back to him, and
 * which rows a shift still owes him an answer on. The database half is proven
 * at the ceremony's read-back and at `server/crewShiftWriterBoundary.test.ts`,
 * which reads the shift tool's own bytes.
 *
 * ⚠ **THE ARMS THAT MATTER ARE THE THREE-WAY ONES.** A tap has three states
 * that a boolean would collapse — waiting, taken back, answered — and every
 * defect this feature could have is one of them being read as another: a
 * withdrawn card closed by a shift, an answered card offered as pending, a
 * pending card drawn as though somebody had looked at it.
 */
import { describe, expect, it } from "vitest";

import {
  CREW_CARD_INTENTS,
  CREW_CARD_INTENT_KEYS,
  CREW_INTENT_NOTE_MAX,
  CREW_INTENT_RESOLUTIONS,
  indexIntentsByCard,
  intentIsPending,
  intentSentence,
  type CrewCardIntentView,
} from "../shared/crewCardIntents";

function intent(overrides: Partial<CrewCardIntentView> = {}): CrewCardIntentView {
  return {
    issueNumber: 312,
    intent: "close",
    markedAt: new Date("2026-08-31T10:00:00Z"),
    withdrawnAt: null,
    resolution: null,
    resolutionNote: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("which taps a shift still owes him an answer on", () => {
  it("a fresh mark is pending", () => {
    expect(intentIsPending(intent())).toBe(true);
  });

  /*
    ⚠ THE ARM THIS WHOLE COLUMN EXISTS FOR. He can take a mark back between a
    shift reading the list and acting on it, and the failure it prevents is a
    card he decided to KEEP being closed. The shift tool re-asks this same
    condition inside its UPDATE's WHERE for the race the list cannot see.
  */
  it("a mark he took back is NOT pending — a shift must not close it", () => {
    expect(intentIsPending(intent({ withdrawnAt: new Date("2026-08-31T11:00:00Z") }))).toBe(false);
  });

  it("an answered mark is not pending either", () => {
    expect(intentIsPending(intent({ resolution: "closed", resolvedAt: new Date() }))).toBe(false);
    expect(intentIsPending(intent({ resolution: "declined", resolutionNote: "still needed" }))).toBe(false);
  });

  /* Withdrawn AND answered — a shift acted, then he changed his mind. Still not
     pending, and by BOTH halves of the condition rather than by luck. */
  it("withdrawn and answered is not pending", () => {
    expect(intentIsPending(intent({ withdrawnAt: new Date(), resolution: "closed" }))).toBe(false);
  });
});

describe("what the panel says back to him", () => {
  it("says nothing about a card he has not touched", () => {
    expect(intentSentence(null)).toBeNull();
    expect(intentSentence(undefined)).toBeNull();
  });

  it("a fresh mark says a shift will check it — the vocabulary's own sentence", () => {
    expect(intentSentence(intent())).toBe(CREW_CARD_INTENTS[0].pending);
  });

  /*
    ⚠ UNDO PUTS THE CARD EXACTLY BACK. A lingering "you took this back" line
    would make one wrong tap cost him a second reading of the row, on a panel
    whose whole purpose is that it is quick to read from bed.
  */
  it("a mark he took back reads like a card he never touched", () => {
    expect(intentSentence(intent({ withdrawnAt: new Date() }))).toBeNull();
  });

  it("a closed card says so plainly", () => {
    expect(intentSentence(intent({ resolution: "closed" }))).toBe("Closed by a shift.");
  });

  /*
    ⚠ HIS CARD'S BAR: *"reports anything it declined to close and why."* The
    REASON is the deliverable, not the verdict — a road where a shift can only
    agree is not a second pair of eyes.
  */
  it("a declined card carries the shift's reason", () => {
    /* ⚠ NO FULL STOP IS APPENDED, and that is a decision rather than an
       oversight: the note is a shift's own prose, and a sentence ending in a
       question mark or an issue number would be given a stop that reads as a
       typo. The reason is quoted as written. */
    expect(intentSentence(intent({ resolution: "declined", resolutionNote: "still blocking #340" })))
      .toBe("Kept open by a shift — still blocking #340");
  });

  /*
    A decline whose note went missing still reads as DECLINED rather than as a
    pending tap. The failure direction that matters is the one where he believes
    nobody has looked yet.
  */
  it("a declined card with no reason still says it was declined", () => {
    expect(intentSentence(intent({ resolution: "declined", resolutionNote: null })))
      .toBe("Kept open by a shift.");
    expect(intentSentence(intent({ resolution: "declined", resolutionNote: "   " })))
      .toBe("Kept open by a shift.");
  });

  /* An intent kind nobody has written a sentence for still says SOMETHING —
     silence would draw a marked card as an unmarked one. */
  it("an unknown intent kind still reads as marked", () => {
    expect(intentSentence(intent({ intent: "something-else" }))).toBe("Marked — a shift will check it.");
  });
});

describe("the vocabulary", () => {
  it("the keys are derived from the list, never a second copy of it", () => {
    expect([...CREW_CARD_INTENT_KEYS]).toEqual(CREW_CARD_INTENTS.map((entry) => entry.key));
  });

  it("every intent carries the sentence the panel draws", () => {
    for (const entry of CREW_CARD_INTENTS) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.pending.length).toBeGreaterThan(0);
    }
  });

  /*
    ⚠ THE LABEL MUST NOT PROMISE A CLOSE. The tap records an intent; a shift
    closes the card. A control labelled "Close" that closes nothing is the
    lying-control shape his own stub ruling forbids, and it is the single
    likeliest edit somebody makes to this file on a tidy-up.
  */
  it("no label claims to close anything", () => {
    for (const entry of CREW_CARD_INTENTS) {
      expect(entry.label.toLowerCase()).not.toContain("close");
      expect(entry.label.toLowerCase()).not.toContain("delete");
    }
  });

  it("the resolutions are the two a shift can honestly give", () => {
    expect([...CREW_INTENT_RESOLUTIONS]).toEqual(["closed", "declined"]);
  });

  /* The note cap matches the column it is written into (`varchar(500)`), so a
     refusal happens at the argument rather than as a truncated sentence on his
     page. */
  it("the note cap is the column's", () => {
    expect(CREW_INTENT_NOTE_MAX).toBe(500);
  });
});

describe("indexing many cards", () => {
  it("finds a card's intent by its number", () => {
    const index = indexIntentsByCard([intent({ issueNumber: 1 }), intent({ issueNumber: 2 })]);
    expect(index.get(2)?.issueNumber).toBe(2);
    expect(index.get(3)).toBeUndefined();
  });

  it("is empty for an empty list, which is the panel's untouched state", () => {
    expect(indexIntentsByCard([]).size).toBe(0);
  });
});
