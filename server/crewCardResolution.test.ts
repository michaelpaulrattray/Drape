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

  /**
   * ⚠ REVERSED, AND THE OLD ARM IS QUOTED RATHER THAN DELETED (#354).
   *
   * It read *"promotes an `open` EYE ITEM on a closed issue"* and asserted
   * exactly that. The belief under it — stated in `crewCardResolution.ts`'s own
   * header as *"an eye item holds nothing up, so it never needs the guard"* —
   * was true of the SCHEMA and false of his PAGE: `CrewEyeGallery` renders
   * `state === "open"` and returns `null` when none is, so the promotion takes
   * the frames off his screen.
   *
   * Measured 2026-09-07: a shift ran the sweep in report mode before shipping
   * and it answered `eyeItems cycle-spend-385-frames: open → done`. Two frames
   * already uploaded for his eyes would have rendered nowhere at all.
   */
  it("HOLDS an `open` eye item on a closed issue — the frames stay on his page", () => {
    const briefing: ResolvableBriefing = {
      eyeItems: [{ ...card("brief-chips-535-frames", "open", 535), cardId: null }],
    };
    const plan = planCardResolutions(briefing, reader({ 535: "CLOSED" }).read);

    expect(plan.promote, "an open eye item was promoted and his frames went dark").toEqual([]);
    expect(plan.held).toHaveLength(1);
    expect(plan.held[0].list).toBe("eyeItems");
    expect(plan.held[0].id).toBe("brief-chips-535-frames");
    expect(plan.held[0].reason).toMatch(/not that he looked/);
  });

  it("still promotes an `answered` eye item — it renders nowhere either way", () => {
    /* THE ARM THAT KEEPS THE RULE FROM BEING "never demote an eye item". The
       gallery shows `open` only, so an `answered` one is already invisible and
       promoting it changes nothing he can see. Without this the fix would
       freeze every eye item on his page for ever. */
    const briefing: ResolvableBriefing = {
      eyeItems: [{ ...card("judged-frames", "answered", 535), cardId: null }],
    };
    const plan = planCardResolutions(briefing, reader({ 535: "CLOSED" }).read);

    expect(plan.held).toEqual([]);
    expect(plan.promote).toEqual([
      { list: "eyeItems", id: "judged-frames", from: "answered", issueNumber: 535 },
    ]);
  });

  it("leaves an open eye item alone while its issue is still OPEN — the negative control", () => {
    /* Nothing is held here because nothing was closing: a hold reported over an
       item the rule was never going to touch is noise on the one report a shift
       reads before it ships. */
    const briefing: ResolvableBriefing = {
      eyeItems: [{ ...card("live-frames", "open", 535), cardId: null }],
    };
    const plan = planCardResolutions(briefing, reader({ 535: "OPEN" }).read);

    expect(plan.promote).toEqual([]);
    expect(plan.held).toEqual([]);
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

  /**
   * ⚠ REVERSED (#354), AND THIS IS THE MEASURED INSTANCE ITSELF.
   *
   * The old arm read *"promotes BOTH when the eye item is closing in the same
   * plan — not a dependant"*, on the reasoning that both land together so
   * neither orphans the other. That is exactly the fixture the sweep met on
   * 2026-09-07: card `cycle-spend-385` and eye item `cycle-spend-385-frames`,
   * both on #385, both promoted, and **the frames would have rendered nowhere**.
   *
   * They still land together — as a HOLD rather than as a promotion. The shift
   * settles the frames and both close on the next sweep; nothing is guessed on
   * his behalf, which is this file's doctrine for every other pass.
   */
  it("HOLDS BOTH when a card and its open frames close on one issue — the #385 instance", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 100), cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED" }).read);

    expect(plan.promote, "the frames went dark and the card followed them").toEqual([]);
    expect(plan.held.map((hold) => hold.id).sort()).toEqual(["a-card", "its-frames"]);
    /* Each is held for its OWN reason — a shift told only about the card would
       settle it and meet the frames on the next sweep. */
    expect(plan.held.find((hold) => hold.id === "its-frames")?.reason).toMatch(/not that he looked/);
    expect(plan.held.find((hold) => hold.id === "a-card")?.reason).toMatch(/its-frames/);
  });

  it("does not hold on an eye item that is already `done`", () => {
    const briefing: ResolvableBriefing = {
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "done", 101), cardId: "a-card" }],
    };
    const plan = planCardResolutions(briefing, reader({ 100: "CLOSED", 101: "OPEN" }).read);

    expect(plan.promote.map((p) => p.id)).toEqual(["a-card"]);
  });

  it("the card's hold names only advice a shift can act on (one issue vs two)", () => {
    /*
      Review of PR #628, finding 2. In the shape that produced this fix the card
      and its frames sit on ONE issue, already closed — so *"or close its
      issue"* was impossible advice in the very instance it was written for. The
      reason line is the one artifact a shift acts on.
    */
    const oneIssue = planCardResolutions({
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 100), cardId: "a-card" }],
    }, reader({ 100: "CLOSED" }).read);
    const cardHold = oneIssue.held.find((hold) => hold.id === "a-card");
    expect(cardHold?.reason).toMatch(/no second issue to close/);

    const twoIssues = planCardResolutions({
      needsYou: [card("a-card", "open", 100)],
      eyeItems: [{ ...card("its-frames", "open", 101), cardId: "a-card" }],
    }, reader({ 100: "CLOSED", 101: "OPEN" }).read);
    const split = twoIssues.held.find((hold) => hold.id === "a-card");
    expect(split?.reason).toMatch(/close their own issue #101/);
    expect(split?.reason, "it offered an option that does not exist").not.toMatch(/no second issue/);
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
