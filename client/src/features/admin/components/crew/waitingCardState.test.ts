import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { CREW_CARD_STATES, crewCardNeedsHim } from "../../../../../../shared/crewCardState";
import { nextUpRows, replyFallsToGeneral } from "./crewTypes";

/**
 * A CARD HE HAS ANSWERED THAT STILL NEEDS AN ACT OF HIS STAYS ON HIS DESK
 * (#354 — his ruling, Crew reply #159: *"The first. Keep it on my desk until
 * the act is done."*).
 *
 * The card's own bar: *"the one arm worth having is a POSITIVE CONTROL — a
 * `waiting` card must appear in What needs you and must NOT appear in
 * history."* Both halves are here, plus the thing the card did not ask for and
 * needed most: the three consumers that used to ask `state === "open"`
 * separately are held to ONE answer, so a fourth state cannot be added to two
 * of them and forgotten in the third.
 */
describe("the waiting state", () => {
  it("still needs him, and history does not claim him", () => {
    /* The positive control, stated as the two facts the render depends on. */
    expect(crewCardNeedsHim("waiting")).toBe(true);
    expect(crewCardNeedsHim("open")).toBe(true);
    /* And the negative one — without this the predicate could be `() => true`. */
    expect(crewCardNeedsHim("answered")).toBe(false);
    expect(crewCardNeedsHim("done")).toBe(false);
  });

  it("keeps his reply under the card instead of dropping it in the General box", () => {
    /*
      The silent failure a literal would have caused: the card renders on his
      desk with a thread, and the thread's replies fall past it into General.
      Two views of one question, disagreeing.
    */
    const cards = [
      { id: "still-his", state: "waiting" },
      { id: "finished", state: "answered" },
      { id: "fresh", state: "open" },
    ] as never;
    expect(replyFallsToGeneral("still-his", cards)).toBe(false);
    expect(replyFallsToGeneral("fresh", cards)).toBe(false);
    expect(replyFallsToGeneral("finished", cards)).toBe(true);
    expect(replyFallsToGeneral(null, cards)).toBe(true);
  });

  it("still marks its NEXT UP row as blocked on him", () => {
    /*
      The second silent failure: a card moved to `waiting` is MORE plainly his
      than an open one, so a NEXT UP row it holds must keep saying so.
    */
    const nextUp = {
      readAt: "2026-09-07T12:00:00.000Z",
      items: [{ issueNumber: 999, title: "A card he is holding", urgent: false }],
    } as never;
    const rows = nextUpRows(nextUp, [
      { id: "holding", state: "waiting", issueNumber: 999 },
    ] as never);
    expect(rows[0]?.blockedOnYou).toBe(true);
    expect(rows[0]?.holdingCardId).toBe("holding");
  });

  it("a card that no longer needs him releases the row — the control on the arm above", () => {
    const nextUp = {
      readAt: "2026-09-07T12:00:00.000Z",
      items: [{ issueNumber: 999, title: "A card he is holding", urgent: false }],
    } as never;
    const rows = nextUpRows(nextUp, [
      { id: "holding", state: "answered", issueNumber: 999 },
    ] as never);
    expect(rows[0]?.blockedOnYou).toBe(false);
  });

  it("the three consumers ask ONE question — none of them compares to a literal", async () => {
    /*
      Working law 4, held at the bytes. Three places decided "does this still
      need him" before #354, and a fourth state added to two of three would
      have failed silently in the two directions the arms above describe.
    */
    const dir = new URL("./", import.meta.url);
    const needsYou = await readFile(new URL("CrewNeedsYou.tsx", dir), "utf8");
    const types = await readFile(new URL("crewTypes.ts", dir), "utf8");

    expect(needsYou).toContain("crewCardNeedsHim(card.state)");
    expect(needsYou).not.toMatch(/card\.state === "open"/);
    expect(types).not.toMatch(/card\.state === "open"/);
    expect((types.match(/crewCardNeedsHim\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the render says which kind it is, in his words rather than the field's", async () => {
    const needsYou = await readFile(new URL("./CrewNeedsYou.tsx", import.meta.url), "utf8");
    expect(needsYou).toContain('card.state === "waiting"');
    expect(needsYou).toContain("Answered · still yours to do");
    expect(needsYou).toContain("dp-crew__waitchip");

    const css = await readFile(new URL("./crew.css", import.meta.url), "utf8");
    const at = css.indexOf(".dp-crew__waitchip {");
    expect(at, "the chip's rule must exist to be read").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    /* Monochrome and quiet: a chore he already agreed to must not outrank a
       fresh question sitting beside it. */
    expect(rule).toContain("var(--faint)");
    expect(rule).not.toMatch(/background:/);
  });

  it("names every state once, in page order", () => {
    expect([...CREW_CARD_STATES]).toEqual(["open", "waiting", "answered", "done"]);
    expect(new Set(CREW_CARD_STATES).size).toBe(CREW_CARD_STATES.length);
  });
});
