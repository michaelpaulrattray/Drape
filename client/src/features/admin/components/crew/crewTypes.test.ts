/**
 * A reply is rendered SOMEWHERE on the page, whatever its card's state — the
 * regression for PR #72 gate-review finding 2.
 *
 * Needs You renders reply threads under OPEN cards only; everything else must
 * fall through to the journal. The first version keyed the fall-through on
 * "card still listed", so a reply on an ANSWERED card — listed under
 * "Recently answered", thread nowhere — rendered on no part of the page. His
 * words are the steering wheel; a rendering rule that can drop them is the
 * server-side never-refuse promise broken at the last step.
 */
import { describe, expect, it } from "vitest";

import {
  JOURNAL_FOLD_VISIBLE,
  foldTimeline,
  milestoneCountLine,
  milestoneProgress,
  replyFallsToJournal,
  splitPipeline,
} from "./crewTypes";

const CARDS = [
  { id: "open-card", state: "open" },
  { id: "answered-card", state: "answered" },
  { id: "done-card", state: "done" },
] as const;

describe("where a reply renders", () => {
  it("a cardless reply is a journal note", () => {
    expect(replyFallsToJournal(null, CARDS)).toBe(true);
  });

  it("a reply on an OPEN card stays with its card's thread", () => {
    expect(replyFallsToJournal("open-card", CARDS)).toBe(false);
  });

  it("⚠ a reply on an ANSWERED or DONE card falls to the journal — the card is listed but renders no thread", () => {
    expect(replyFallsToJournal("answered-card", CARDS)).toBe(true);
    expect(replyFallsToJournal("done-card", CARDS)).toBe(true);
  });

  it("a reply whose card left the briefing entirely falls to the journal", () => {
    expect(replyFallsToJournal("a-card-no-briefing-holds", CARDS)).toBe(true);
  });

  it("exhaustive: every card state routes every reply somewhere", () => {
    /* The invariant itself: for ANY cardId, the reply renders in the journal
       OR under an open card's thread — never neither. */
    const everyCardId = [null, ...CARDS.map((card) => card.id), "gone-card"];
    for (const cardId of everyCardId) {
      const inJournal = replyFallsToJournal(cardId, CARDS);
      const inOpenThread =
        cardId !== null && CARDS.some((card) => card.id === cardId && card.state === "open");
      expect(inJournal || inOpenThread, `a reply on ${String(cardId)} renders nowhere`).toBe(true);
      expect(inJournal && inOpenThread, `a reply on ${String(cardId)} renders twice`).toBe(false);
    }
  });
});

/* ─── #74's derivations. Each is the Desk's information design READ off data
   the briefing already carries — these arms are what stops the bar, the split
   and the fold from quietly becoming second copies of state. ─── */

describe("the milestone progress bar (#74)", () => {
  it("counts each state and fills done + half of in-progress", () => {
    const progress = milestoneProgress([
      { state: "done" },
      { state: "in-progress" },
      { state: "waiting" },
      { state: "blocked" },
    ]);
    expect(progress).toEqual({
      done: 1,
      inProgress: 1,
      waiting: 1,
      blocked: 1,
      total: 4,
      fraction: (1 + 0.5) / 4,
    });
  });

  it("an empty step list is 0, not NaN — a NaN width collapses the bar silently", () => {
    expect(milestoneProgress([]).fraction).toBe(0);
  });

  it("all done reads 1.0 — the bar can actually fill", () => {
    expect(milestoneProgress([{ state: "done" }, { state: "done" }]).fraction).toBe(1);
  });

  it("the count line says only what is non-zero", () => {
    expect(
      milestoneCountLine(milestoneProgress([{ state: "done" }, { state: "waiting" }, { state: "waiting" }])),
    ).toBe("1 done · 2 waiting");
    expect(milestoneCountLine(milestoneProgress([{ state: "blocked" }]))).toBe("1 blocked");
  });
});

describe("the pipeline split (#74)", () => {
  const ITEMS = [
    { id: "a", title: "a", status: "building", prNumber: null, note: null },
    { id: "b", title: "b", status: "merged", prNumber: 1, note: null },
    { id: "c", title: "c", status: "blocked", prNumber: null, note: null },
    { id: "d", title: "d", status: "in-review", prNumber: 2, note: null },
    { id: "e", title: "e", status: "waiting-founder", prNumber: null, note: null },
  ] as const;

  it("landed is exactly the merged rows; everything else is in flight", () => {
    const { inFlight, landed } = splitPipeline([...ITEMS]);
    expect(landed.map((item) => item.id)).toEqual(["b"]);
    expect(inFlight.map((item) => item.id)).toEqual(["a", "c", "d", "e"]);
  });

  it("exhaustive: every item renders in exactly one half", () => {
    const { inFlight, landed } = splitPipeline([...ITEMS]);
    expect(inFlight.length + landed.length).toBe(ITEMS.length);
    const ids = new Set([...inFlight, ...landed].map((item) => item.id));
    expect(ids.size).toBe(ITEMS.length);
  });
});

describe("the journal fold (#74 — his standing Desk rule)", () => {
  it(`shows ${JOURNAL_FOLD_VISIBLE} and folds the rest, order preserved`, () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    const { recent, older } = foldTimeline(items);
    expect(recent).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(older).toEqual([8, 9, 10]);
  });

  it("a short timeline folds nothing — no empty disclosure button", () => {
    const { recent, older } = foldTimeline([0, 1, 2]);
    expect(recent).toEqual([0, 1, 2]);
    expect(older).toEqual([]);
  });

  it("the boundary itself: exactly the visible count folds nothing", () => {
    const items = Array.from({ length: JOURNAL_FOLD_VISIBLE }, (_, index) => index);
    expect(foldTimeline(items).older).toEqual([]);
  });
});
