/**
 * THE REPAIRS-OWED SUMMARY ON HIS BOARD — #1977.
 *
 * ⚠ **THE ONE THING THESE ARMS EXIST FOR IS THE POPULATION.** A summary beside
 * a list is only worth drawing if it counts the same rows the list draws as
 * held; a reader that counted every open pull request, or every row wanting a
 * person, would look perfectly right on a board where everything is held — which
 * is exactly the board he complained about. So the negative rows are the
 * assertions that matter here, not the positive ones.
 */
import { describe, expect, it } from "vitest";

import { crewRepairsOwed, crewRepairsOwedLabel } from "./crewRepairsOwed";
import type { CrewLivePullRequest } from "./crewTypes";

const row = (
  number: number,
  state: CrewLivePullRequest["state"],
  repairFlaggedAt: string | null,
): CrewLivePullRequest => ({
  number,
  title: `PR ${number}`,
  state,
  cards: [],
  author: "shift",
  updatedAt: "2026-10-08T08:00:00Z",
  repairFlaggedAt,
  url: `https://github.com/x/y/pull/${number}`,
});

/* The card is #1977 — in a comment, because the hex guard reads a bare `#1977`
   in code as a colour literal and is right to. */
describe("the repairs-owed summary on his board", () => {
  it("counts only the rows the list calls held, and takes the oldest flag", () => {
    const owed = crewRepairsOwed([
      row(1, "finding", "2026-10-08T05:30:00Z"),
      row(2, "finding", "2026-10-08T01:00:00Z"),
      row(3, "finding", "2026-10-08T07:00:00Z"),
    ]);
    expect(owed).toEqual({ count: 3, oldest: "2026-10-08T01:00:00Z" });
  });

  it("⚠ every other state counts for nothing — the arm that matters", () => {
    /*
      `held` is the near miss and it is in here on purpose: it is drawn as
      *Waiting for review*, it wears the same emphasis as a finding on the page,
      and it is NOT a repair anybody owes. A reader keyed on "wants a person"
      rather than on the state would pass every other arm in this file.
    */
    const owed = crewRepairsOwed([
      row(1, "held", "2026-10-08T01:00:00Z"),
      row(2, "gate", null),
      row(3, "draft", null),
      row(4, "passed", null),
    ]);
    expect(owed).toEqual({ count: 0, oldest: null });
    expect(crewRepairsOwedLabel(owed)).toBeNull();
  });

  it("counts a held row even when its flag could not be read", () => {
    /*
      The count and the clock are two facts and only one of them can go missing.
      A pull request the page knows is held but cannot date is still work
      somebody owes, and dropping it from the COUNT to keep the age tidy would
      hide the row this whole block exists to surface.
    */
    const owed = crewRepairsOwed([
      row(1, "finding", null),
      row(2, "finding", "2026-10-08T03:00:00Z"),
    ]);
    expect(owed.count).toBe(2);
    expect(owed.oldest).toBe("2026-10-08T03:00:00Z");

    const noneDatable = crewRepairsOwed([row(1, "finding", null)]);
    expect(noneDatable).toEqual({ count: 1, oldest: null });
    expect(crewRepairsOwedLabel(noneDatable)).toBe("1 needs a repair");
  });

  it("an empty string is not a timestamp", () => {
    expect(crewRepairsOwed([row(1, "finding", "")])).toEqual({ count: 1, oldest: null });
  });

  it("says one and many in English, and says nothing at zero", () => {
    expect(crewRepairsOwedLabel({ count: 1, oldest: null })).toBe("1 needs a repair");
    expect(crewRepairsOwedLabel({ count: 9, oldest: null })).toBe("9 need a repair");
    /* ⚠ Nothing at all rather than "0 need a repair" — a number nobody can act
       on is the thing his ruling on the problems list was about. */
    expect(crewRepairsOwedLabel({ count: 0, oldest: null })).toBeNull();
  });

  it("an empty board is quiet", () => {
    const owed = crewRepairsOwed([]);
    expect(owed).toEqual({ count: 0, oldest: null });
    expect(crewRepairsOwedLabel(owed)).toBeNull();
  });
});
