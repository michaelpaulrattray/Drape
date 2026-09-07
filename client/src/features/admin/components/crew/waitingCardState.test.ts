import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

  it("NOBODY asks the question with a literal — the population is derived, not listed", async () => {
    /*
      ⚠ THIS ARM REPLACES ONE THAT NAMED THREE FILES, AND THE REVIEW OF PR #648
      IS WHY.

      The first version scanned `CrewNeedsYou.tsx` and `crewTypes.ts` — the two
      the fix had touched — so it pinned the consumers that were ALREADY right
      and could not see the ones that were not. There were six more: the desk
      sweep's hold label (the severe one: the escalation gate reads labels only,
      so a `waiting` card would have looked takeable while this page said
      otherwise), the sweep's waiting-founder report, BOTH briefing refinements,
      the eye gallery, and two in the resolution planner.

      A guard whose population is the set of files you already fixed stops
      watching the moment you fix one. So the population is derived: every
      source file on the desk's surface, and the arm fails on the literal
      wherever it appears.
    */
    const roots = [
      new URL("./", import.meta.url),
      new URL("../../../../../../server/crew/", import.meta.url),
      new URL("../../../../../../shared/", import.meta.url),
      new URL("../../../../../../scripts/", import.meta.url),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = fileURLToPath(root);
      for (const name of await readdir(dir)) {
        if (!/\.(ts|tsx|mts)$/.test(name)) continue;
        if (/\.test\.(ts|tsx)$/.test(name)) continue;
        if (root.href.endsWith("/shared/") && !name.startsWith("crew")) continue;
        if (root.href.endsWith("/scripts/") && !name.startsWith("crew-")) continue;
        const src = await readFile(join(dir, name), "utf8");
        /* CODE ONLY — a docblock may quote the retired literal, and several
           deliberately do to explain what changed. Comments are stripped first
           so quoting the defect is never mistaken for committing it. */
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        for (const m of code.matchAll(/(\w+)\.state\s*[!=]==\s*"open"/g)) {
          /* `problem.state` is a different field with three states of its own
             and no notion of him — it is not this question. */
          if (m[1] === "problem") continue;
          offenders.push(`${name}: ${m[0]}`);
        }
      }
    }
    expect(offenders, "these ask 'does this still need him' with a literal").toEqual([]);

    /* ⚠ TWO POSITIVE CONTROLS, because an empty `offenders` is a claim about a
       checker (working law 2, and the review of this PR asked for the second).

       The first proves the scanner READ something. The second proves the
       PATTERN can still match an offender — a lost escape or a stray `=` in a
       future edit would empty `offenders` forever and leave this arm green,
       which is the checker that cannot fail. */
    const needsYou = await readFile(new URL("./CrewNeedsYou.tsx", import.meta.url), "utf8");
    expect(needsYou).toContain("crewCardNeedsHim(card.state)");
    expect('const x = card.state === "open";'.match(/(\w+)\.state\s*[!=]==\s*"open"/))
      .not.toBeNull();
    expect('if (item.state !== "open") return;'.match(/(\w+)\.state\s*[!=]==\s*"open"/))
      .not.toBeNull();
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
