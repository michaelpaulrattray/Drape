/**
 * THE DESK SWEEP'S CLOSED-ISSUE RULE, DRIVEN (issue #604).
 *
 * The instance: `deploy-flip-508` sat OPEN on his page asking him to enter three
 * Railway fields he had already entered, because the sweep promoted only from
 * `answered` and nothing had marked that card answered.
 *
 * The arms that matter are the two the card asked for — an `open` card on a
 * CLOSED issue becomes `done`, an `open` card on an OPEN issue is untouched —
 * plus the two the card did not foresee: promoting an `open` card can orphan a
 * dependant that the briefing schema then refuses at the parse, and both of
 * those roads must be HELD rather than written.
 */
import { describe, expect, it } from "vitest";

import {
  type IssueState,
  type ResolvableBriefing,
  planCardResolutions,
  promotionLine,
} from "../shared/crewCardResolution.js";

/** A reader over a fixed table; anything not named reads as unreadable. */
function reader(table: Record<number, IssueState>) {
  const asked: number[] = [];
  const read = (issueNumber: number): IssueState => {
    asked.push(issueNumber);
    return table[issueNumber] ?? null;
  };
  return { read, asked };
}

const card = (id: string, state: string, issueNumber: number | null) => ({ id, state, issueNumber });

describe("planCardResolutions — a card whose issue closed is finished (#604)", () => {
  it("promotes an `open` card whose issue is CLOSED — the deploy-flip-508 instance", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("deploy-flip-508", "open", 508)] };
    const plan = planCardResolutions(briefing, reader({ 508: "CLOSED" }).read);

    expect(plan.promote).toEqual([
      { list: "needsYou", id: "deploy-flip-508", from: "open", issueNumber: 508 },
    ]);
    expect(plan.held).toEqual([]);
    expect(promotionLine(plan.promote[0])).toContain("resolved by the card's issue closing");
  });

  it("leaves an `open` card whose issue is still OPEN alone — the negative control", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("still-wanted", "open", 404)] };
    const plan = planCardResolutions(briefing, reader({ 404: "OPEN" }).read);

    expect(plan.promote).toEqual([]);
    expect(plan.held).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it("still promotes from `answered`, and says so in the old words", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("an-answered-card", "answered", 12)] };
    const plan = planCardResolutions(briefing, reader({ 12: "CLOSED" }).read);

    expect(plan.promote).toHaveLength(1);
    expect(promotionLine(plan.promote[0])).toBe(
      "needsYou an-answered-card: answered → done (#12 is closed)",
    );
  });

  it("never promotes a card that is already `done`", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("finished", "done", 12)] };
    expect(planCardResolutions(briefing, reader({ 12: "CLOSED" }).read).promote).toEqual([]);
  });

  it("promotes an `open` EYE ITEM on a closed issue — brief-chips-535-frames, set by hand", () => {
    const briefing: ResolvableBriefing = {
      eyeItems: [{ ...card("brief-chips-535-frames", "open", 535), cardId: null }],
    };
    const plan = planCardResolutions(briefing, reader({ 535: "CLOSED" }).read);

    expect(plan.promote).toEqual([
      { list: "eyeItems", id: "brief-chips-535-frames", from: "open", issueNumber: 535 },
    ]);
  });
});

describe("planCardResolutions — a promotion that would break his page is HELD (#604)", () => {
  it("HOLDS a card whose open eye item would be orphaned (#133's refinement)", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 101), cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED", 101: "OPEN" }).read);

    expect(plan.promote).toEqual([]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].id).toBe("a-card");
    expect(plan.held[0].reason).toContain("its-frames");
  });

  it("promotes BOTH when the eye item is closing in the same plan — not a dependant", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 100), cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED" }).read);

    expect(plan.held).toEqual([]);
    expect(plan.promote.map((p) => p.id).sort()).toEqual(["a-card", "its-frames"]);
  });

  it("does not hold on an eye item that is already `done`", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "done", 101), cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED", 101: "OPEN" }).read);

    expect(plan.promote.map((p) => p.id)).toEqual(["a-card"]);
  });

  it("HOLDS a card a `waiting-founder` row still names (#291's refinement)", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      pipeline: [{ id: "a-row", status: "waiting-founder", cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED" }).read);

    expect(plan.promote).toEqual([]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].reason).toContain("a-row");
  });

  it("names BOTH holds when a card has both, so the shift does not make two trips", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 101), cardId: "a-card" }],
      pipeline: [{ id: "a-row", status: "waiting-founder", cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED", 101: "OPEN" }).read);

    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].reason).toContain("its-frames");
    expect(plan.held[0].reason).toContain("a-row");
  });

  /*
    ⚠ THE ORDERING ARM (review of PR #609, finding 1). The sweep repairs a
    merged pipeline row BEFORE it plans the cards, so by the time this function
    runs, a row whose PR merged is already `merged` and has lost its cardId. If
    that order is ever reversed, the sweep reports "row → merged" and "card held
    by that row" in one breath. This arm pins the contract this function relies
    on: a row that is no longer `waiting-founder` holds nothing.
  */
  it("a pipeline row that is NOT waiting-founder holds nothing up", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      pipeline: [{ id: "a-row", status: "merged", cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED" }).read);

    expect(plan.promote.map((p) => p.id)).toEqual(["a-card"]);
  });
});

describe("planCardResolutions — a failed read is never a verdict (working law 2)", () => {
  it("reports an unreadable issue and promotes nothing on it", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("a-card", "open", 100)] };
    const plan = planCardResolutions(briefing, reader({}).read);

    expect(plan.promote).toEqual([]);
    expect(plan.unreadable).toEqual([{ list: "needsYou", id: "a-card", issueNumber: 100 }]);
  });

  it("a card with no issue number is not a candidate and is not reported as unreadable", () => {
    const briefing: ResolvableBriefing = { needsYou: [card("a-card", "open", null)] };
    const plan = planCardResolutions(briefing, reader({}).read);

    expect(plan.promote).toEqual([]);
    expect(plan.unreadable).toEqual([]);
  });

  it("reads each issue ONCE, so a flaky reader cannot answer two ways in one plan", () => {
    const table = reader({ 100: "CLOSED" });
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 100), cardId: "a-card" }],
    };
    planCardResolutions(briefing, table.read);

    expect(table.asked).toEqual([100]);
  });
});
