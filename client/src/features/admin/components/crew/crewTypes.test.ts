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

import { replyFallsToJournal } from "./crewTypes";

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
