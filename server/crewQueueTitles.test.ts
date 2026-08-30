/**
 * THE CARD TITLES UNDER HIS SWITCH, DRIVEN DIRECTLY (#285,
 * `shared/crewQueueTitles.ts`).
 *
 * Two properties carry this feature and both are easy to lose silently:
 *
 *   1. **The parse's only failure mode is an empty list.** This value is a JSON
 *      string written by a script and read inside `crew.getState` — the ONE
 *      call his whole Crew tab makes — so a throw here is a blank page for the
 *      founder. Every hostile shape below must degrade to the panel he has
 *      today rather than to an error.
 *   2. **No titles means no `+N more`.** Between the deploy and his ceremony
 *      the column does not exist, so every category has a real count and zero
 *      titles; a naive subtraction draws "+10 more" under a list that names
 *      nothing. That is a promise of something that is not there, which is
 *      worse than the count he has now.
 *
 * ⚠ Each arm that expects an empty result is paired with one that expects a
 * FULL result from the same function. A `parseQueueTitles` changed to
 * `return []` would otherwise pass the entire defensive half of this file —
 * the absence-only failure this repository has a memory about, and the shape it
 * would take here is a panel that quietly stopped showing titles, which looks
 * exactly like a queue with nothing in it.
 */
import { describe, expect, it } from "vitest";

import {
  QUEUE_TITLES_PER_CATEGORY,
  parseQueueTitles,
  queueTitlesView,
  serializeQueueTitles,
} from "../shared/crewQueueTitles";

const REAL = [
  { number: 312, title: "The rest of #298's class: two states on his Crew page that nothing re-reads" },
  { number: 308, title: "Model 35 will not delete — nine accepted_candidate plates fail a SHAPE check" },
  { number: 306, title: "Billing modals fetch on MOUNT, not on open" },
];

describe("the round trip — the control every negative arm below is measured against", () => {
  it("CONTROL — real cards survive serialize → parse unchanged", () => {
    const back = parseQueueTitles(serializeQueueTitles(REAL));
    expect(back).toEqual(REAL);
    expect(back).toHaveLength(3);
  });

  it("CONTROL — a full view names its cards and its remainder", () => {
    const view = queueTitlesView(10, parseQueueTitles(serializeQueueTitles(REAL)));
    expect(view.shown).toHaveLength(3);
    expect(view.shown[0]!.number).toBe(312);
    expect(view.moreCount).toBe(7);
  });
});

describe("the parse degrades to an empty list and never throws", () => {
  /* Each of these is a real state: null is the column with nothing written yet,
     "" and a truncated string are a half-written value, and the rest are what a
     hand-edited row or a future writer bug would leave behind. */
  const hostile: Array<[string, unknown]> = [
    ["null — the column exists and no shift has written it", null],
    ["undefined — the column is absent and the reader rescued", undefined],
    ["the empty string", ""],
    ["whitespace only", "   "],
    ["truncated JSON, cut mid-write", '[{"number":312,"title":"The rest'],
    ["not JSON at all", "10 open"],
    ["an object where an array belongs", '{"number":312,"title":"x"}'],
    ["a JSON string, not an array", '"312"'],
    ["a number", "312"],
    ["already-parsed data rather than a string", REAL],
  ];
  for (const [name, value] of hostile) {
    it(`${name} reads as no titles`, () => {
      expect(() => parseQueueTitles(value)).not.toThrow();
      expect(parseQueueTitles(value)).toEqual([]);
    });
  }

  it("drops only the entries that are not cards, and keeps the rest", () => {
    const mixed = JSON.stringify([
      { number: 312, title: "kept" },
      { number: "308", title: "a string number is not a card" },
      { number: 306 },
      { title: "no number" },
      null,
      "a bare string",
      { number: 0, title: "zero is not an issue number" },
      { number: -4, title: "nor is a negative one" },
      { number: 30.5, title: "nor a fraction" },
      { number: 302, title: "   " },
      { number: 296, title: "  also kept, trimmed  " },
    ]);
    expect(parseQueueTitles(mixed)).toEqual([
      { number: 312, title: "kept" },
      { number: 296, title: "also kept, trimmed" },
    ]);
  });
});

describe("five is the cap, at the write as well as the draw", () => {
  const ten = Array.from({ length: 10 }, (_, index) => ({ number: 400 - index, title: `card ${index}` }));

  it("the writer stores five, so the row never becomes a copy of the queue", () => {
    const stored = JSON.parse(serializeQueueTitles(ten));
    expect(stored).toHaveLength(QUEUE_TITLES_PER_CATEGORY);
    /* Order is the caller's and is preserved — `crew-count-queue.mts` sorts
       most-recent-first before calling, so the five kept are the five newest. */
    expect(stored[0].number).toBe(400);
    expect(stored[4].number).toBe(396);
  });

  it("and the parse caps again, so a hand-written row cannot lengthen the panel", () => {
    expect(parseQueueTitles(JSON.stringify(ten))).toHaveLength(QUEUE_TITLES_PER_CATEGORY);
  });

  it("the view shows five and calls the rest the remainder", () => {
    const view = queueTitlesView(10, parseQueueTitles(JSON.stringify(ten)));
    expect(view.shown).toHaveLength(5);
    expect(view.moreCount).toBe(5);
  });
});

describe("⚠ the remainder is never drawn without a list to be the remainder OF", () => {
  /*
    THE LOAD-BEARING ARM. Between this code deploying and the founder running
    `scripts/ceremony-crew-queue-count-titles.mts`, the column does not exist:
    every category has a real `openCount` and an empty title list. "+10 more"
    under nothing is a promise of a list that is not there.
  */
  it("a real count with NO titles draws no remainder", () => {
    const view = queueTitlesView(10, []);
    expect(view.shown).toEqual([]);
    expect(view.moreCount).toBe(0);
  });

  it("CONTROL — the same count WITH titles does draw one", () => {
    expect(queueTitlesView(10, REAL).moreCount).toBe(7);
  });

  it("a complete list has no remainder", () => {
    expect(queueTitlesView(3, REAL).moreCount).toBe(0);
  });

  /*
    A count SMALLER than the titles beside it cannot happen in one statement —
    they are written together — but it is what a hand-edited row or a future
    second writer would produce, and a negative remainder rendered as "+-2 more"
    is the kind of thing that reaches his page.
  */
  it("a count smaller than its own titles never goes negative", () => {
    expect(queueTitlesView(1, REAL).moreCount).toBe(0);
    expect(queueTitlesView(0, REAL).moreCount).toBe(0);
  });
});
