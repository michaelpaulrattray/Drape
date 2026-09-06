import { describe, expect, it } from "vitest";

import {
  CREW_HELD_STATES,
  CREW_HOLD_LABELS,
  CREW_HOLD_MARKER,
  CREW_HOLD_ORDER,
  CREW_HOLD_REASON_MAX,
  CREW_HOLD_WORD,
  heldStateFromLabels,
  heldStatesFromLabels,
  holdReasonFromBody,
  planDeskHoldLabels,
  resolveHold,
} from "../shared/crewNextUpHold.js";

/**
 * The hold verdict's own arms (#298) — the two readers `crew-desk-sweep.mts`
 * runs over the queue, driven directly rather than through the sweep.
 *
 * The sweep shells out to `gh`, so a test of it would be a test of a mock.
 * These drive the functions the sweep calls with the shapes GitHub actually
 * returns, which is the half a mock could not have told the truth about.
 */

describe("the state comes from a LABEL, and only from a label", () => {
  it("each label puts a card in its own state", () => {
    expect(heldStateFromLabels(["blocked"])).toBe("blocked");
    expect(heldStateFromLabels(["awaiting-fable"])).toBe("fable");
    expect(heldStateFromLabels(["needs-sitting"])).toBe("sitting");
  });

  it("an unheld card is null — takeable is the default, never a state to declare", () => {
    expect(heldStateFromLabels([])).toBeNull();
    expect(heldStateFromLabels(["urgent", "founder-ordered", "bug"])).toBeNull();
  });

  /**
   * ⚠ **`needs-fable` ALREADY MEANS SOMETHING ELSE** — *"force the full Fable
   * review on this PR"*, a PR-scoped instruction to the gate. A card asking for
   * a review and a card waiting on the review arm must stay distinguishable,
   * because one of them is takeable.
   */
  it("the existing needs-fable label does NOT hold a card", () => {
    expect(heldStateFromLabels(["needs-fable"])).toBeNull();
    expect(CREW_HOLD_LABELS.fable).not.toBe("needs-fable");
  });

  it("two hold labels resolve to the one furthest from takeable", () => {
    expect(heldStateFromLabels(["needs-sitting", "blocked"])).toBe("sitting");
    expect(heldStateFromLabels(["blocked", "awaiting-fable"])).toBe("fable");
  });

  /**
   * THE COLLAPSE IS LOSSY, AND A CALLER THAT ACTS ON IT CAN BE WRONG (found by
   * the reviewer on PR #544, 2026-09-05, before it shipped).
   *
   * The line directly above is correct for a CHIP, which shows one word. But
   * `blocked` + `awaiting-fable` answering "fable" told the auto-escalation gate
   * that a BLOCKED card was Fable's to take, and that gate spends an expensive
   * session when it agrees. So the full list is the answer for anyone deciding
   * whether they may act, and the one-word answer is derived from it.
   */
  it("reports EVERY hold, so a caller can ask about one instead of the winner", () => {
    expect(heldStatesFromLabels(["blocked", "awaiting-fable"])).toEqual(["fable", "blocked"]);
    expect(heldStatesFromLabels(["needs-sitting", "blocked"])).toEqual(["sitting", "blocked"]);
    expect(heldStatesFromLabels(["awaiting-fable"])).toEqual(["fable"]);
    expect(heldStatesFromLabels(["urgent", "founder-ordered"])).toEqual([]);
  });

  it("keeps the one-word answer DERIVED from the full list, never a second sort", () => {
    for (const labels of [
      ["blocked", "awaiting-fable"],
      ["needs-sitting", "blocked", "awaiting-fable"],
      ["awaiting-fable"],
      ["urgent"],
      [],
    ]) {
      expect(heldStateFromLabels(labels)).toBe(heldStatesFromLabels(labels)[0] ?? null);
    }
  });

  /**
   * Working law 4, asserted rather than trusted: the enum the schema validates
   * against, the precedence order and the chip words are all DERIVED from the
   * one label map, so a fourth hold cannot exist in three lists and not the
   * fourth.
   */
  it("every list is the same population, derived from one", () => {
    const states = Object.keys(CREW_HOLD_LABELS).sort();
    expect([...CREW_HELD_STATES].sort()).toEqual(states);
    expect([...CREW_HOLD_ORDER].filter((kind) => kind !== "you").sort()).toEqual(states);
    expect(Object.keys(CREW_HOLD_WORD).sort()).toEqual(["you", ...states].sort());
    for (const state of CREW_HELD_STATES) {
      expect(CREW_HOLD_WORD[state], `${state} must have a word`).toBeTruthy();
    }
  });

  it("`you` is not a label — his desk owns that verdict, not the queue", () => {
    expect(Object.values(CREW_HOLD_LABELS)).not.toContain("you");
    expect(heldStateFromLabels(["you"])).toBeNull();
  });
});

describe("the reason comes from ONE line of the body", () => {
  const body = (...lines: string[]) => lines.join("\n");

  it("reads the marker line and nothing around it", () => {
    expect(holdReasonFromBody(body(
      "# A card",
      "",
      `${CREW_HOLD_MARKER} the sectioned Settings modal (your section 03 brief)`,
      "",
      "More prose that is not the reason.",
    ))).toBe("the sectioned Settings modal (your section 03 brief)");
  });

  it("a body with no marker has no reason — the chip stands alone", () => {
    /* Demanding prose would let a filer's omission quietly un-hold a card. */
    expect(holdReasonFromBody("# A card with no marker at all")).toBeNull();
    expect(holdReasonFromBody("")).toBeNull();
  });

  it("an empty marker is the same as no marker", () => {
    expect(holdReasonFromBody(`${CREW_HOLD_MARKER}   `)).toBeNull();
  });

  it("indented and CRLF bodies still read — GitHub returns both", () => {
    expect(holdReasonFromBody(`intro\r\n   ${CREW_HOLD_MARKER} a sitting of its own\r\nmore`))
      .toBe("a sitting of its own");
  });

  /**
   * ⚠ **THE FIRST MARKER WINS.** A body that says it twice is a card mid-edit;
   * taking the first keeps the answer stable while somebody is typing, and
   * taking the last would let a quoted example at the bottom of a card beat the
   * filer's own line.
   */
  it("the first marker wins, so a quoted example lower down cannot hijack it", () => {
    expect(holdReasonFromBody(body(
      `${CREW_HOLD_MARKER} the real reason`,
      "For example, a card might say:",
      `${CREW_HOLD_MARKER} something else entirely`,
    ))).toBe("the real reason");
  });

  it("a long reason is truncated by the writer, so the page never has to be", () => {
    const long = "x".repeat(CREW_HOLD_REASON_MAX + 40);
    const read = holdReasonFromBody(`${CREW_HOLD_MARKER} ${long}`)!;
    expect(read.length).toBeLessThanOrEqual(CREW_HOLD_REASON_MAX);
    expect(read.endsWith("…")).toBe(true);
  });
});

describe("the resolved verdict", () => {
  it("takeable is null, not a state", () => {
    expect(resolveHold({ blockedOnYou: false, held: null })).toBeNull();
    expect(resolveHold({ blockedOnYou: false, held: undefined })).toBeNull();
  });

  it("his desk outranks any label", () => {
    expect(resolveHold({ blockedOnYou: true, held: { state: "sitting" } })?.kind).toBe("you");
    expect(resolveHold({ blockedOnYou: true, held: null })?.word).toBe("Waiting on you");
  });

  it("the word is resolved here so no caller retypes it", () => {
    for (const state of CREW_HELD_STATES) {
      expect(resolveHold({ blockedOnYou: false, held: { state } })?.word)
        .toBe(CREW_HOLD_WORD[state]);
    }
  });
});

/**
 * ⚠ THE DESK'S ANSWER, TRANSLATED INTO THE LABEL VOCABULARY (#586).
 *
 * The incident: on 2026-09-06 the #508 Fable shift parked its card on his desk,
 * removed `awaiting-fable`, and applied nothing in its place. Twenty-one
 * minutes later the escalation gate answered *"NONE: the next card is #508,
 * which an Opus shift can take"* — so an Opus shift launched and **#535, the
 * next `awaiting-fable` card in his own order, was never escalated**. A hold
 * that lives only in prose is invisible to the thing that launches shifts.
 *
 * The fixtures below are the four cards of that morning.
 */
describe("a card his desk is holding gets a label the escalation gate can see", () => {
  const orderedCard = (issueNumber: number, labels: string[] = [], body = "") =>
    ({ issueNumber, labels, body });

  it("⚠ THE #586 CASE: on his desk, no hold label — apply `blocked`", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(508)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([
      { issueNumber: 508, deskCardId: "deploy-flip-508", bodyCarriesFossil: false },
    ]);
    expect(plan.stale).toEqual([]);
  });

  it("the desk card ID rides along, so the report says WHY rather than just what", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(508)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply[0]?.deskCardId).toBe("deploy-flip-508");
  });

  it("a card already carrying ANY hold label is left alone — a second chip changes nothing", () => {
    for (const label of Object.values(CREW_HOLD_LABELS)) {
      const plan = planDeskHoldLabels({
        ordered: [orderedCard(535, [label])],
        deskOpen: [{ issueNumber: 535, cardId: "reimagine-design-535" }],
      });
      expect(plan.apply, `already held by ${label}`).toEqual([]);
    }
  });

  it("⚠ THE NEGATIVE CONTROL: a card his desk does NOT name is never labelled", () => {
    /* Without this arm the rule could be "label everything" and every arm
       above would still pass. */
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(543)],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([]);
  });

  it("a desk card that has been ANSWERED does not hold anything — only OPEN cards are passed in", () => {
    /* The sweep filters on `state === "open"` before calling; this pins the
       contract that an empty desk produces an empty plan rather than a
       hold-everything default. */
    expect(planDeskHoldLabels({ ordered: [orderedCard(543)], deskOpen: [] }).apply).toEqual([]);
  });

  it("two open desk cards naming one issue hold it once, not twice", () => {
    const plan = planDeskHoldLabels({
      ordered: [orderedCard(530)],
      deskOpen: [
        { issueNumber: 530, cardId: "tail-court-reimagine-530" },
        { issueNumber: 530, cardId: "tail-court-verdict-530" },
      ],
    });
    expect(plan.apply).toHaveLength(1);
  });
});

/**
 * ⚠ IT APPLIES AND IT NEVER REMOVES — the asymmetry the module header argues
 * for, driven rather than promised.
 *
 * `blocked` is applied by hand for reasons that have nothing to do with his
 * desk (#404 is blocked on #391's ladder fold), so a script that stripped it
 * on a silent desk would un-hold a card nobody had read.
 */
describe("a hold whose reason has gone is REPORTED, never cleared", () => {
  it("⚠ #404's real shape: `blocked` with a written reason, desk silent — reported QUIETLY", () => {
    /* The first shape filtered this card out entirely, and that is the defect
       the reviewer found: the marker line cannot tell a live hand-hold from a
       FOSSIL one, so filtering on it freezes any card whose body ever carried
       a line. It is reported; `hasWrittenReason` sets the loudness. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 404,
        labels: ["design-unbuilt", "founder-ordered", "blocked"],
        body: `${CREW_HOLD_MARKER} #391 — the blurb is one line per rung, and the ladder folds first.`,
      }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 404, hasWrittenReason: true }]);
    expect(plan.apply).toEqual([]);
  });

  it("`blocked`, no written reason, desk silent — reported LOUDLY", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "no marker line here" }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 508, hasWrittenReason: false }]);
  });

  it("⚠ THE FOSSIL CARD: once hand-held, unblocked, now on his desk — the old line is flagged", () => {
    /* PR #613 review, finding 1, the second symptom. #298 deliberately leaves a
       rotted marker line in a body when a label is removed, because nothing
       renders it. A hold applied HERE would adopt that sentence and show it
       beside a brand-new chip, which is exactly the "stale reason outliving its
       state" bug #298 was built to kill. The caller is told, and takes its
       reason from the desk instead. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 508,
        labels: ["founder-ordered"],
        body: `${CREW_HOLD_MARKER} #391 — a hold that ended weeks ago.`,
      }],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.apply).toEqual([
      { issueNumber: 508, deskCardId: "deploy-flip-508", bodyCarriesFossil: true },
    ]);
  });

  it("⚠ AND IT CANNOT FREEZE: the same fossil card, after his desk card is answered", () => {
    /* The reviewer's own failure scenario, driven end to end. Under the first
       shape this returned an EMPTY stale list — the card kept `blocked` for
       ever and was named to nobody. */
    const plan = planDeskHoldLabels({
      ordered: [{
        issueNumber: 508,
        labels: ["founder-ordered", "blocked"],
        body: `${CREW_HOLD_MARKER} #391 — a hold that ended weeks ago.`,
      }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([{ issueNumber: 508, hasWrittenReason: true }]);
  });

  it("the plan NEVER carries a removal — there is no shape for one", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "" }],
      deskOpen: [],
    });
    expect(Object.keys(plan).sort()).toEqual(["apply", "stale"]);
  });

  it("a card still on his desk is not stale, whatever its body says", () => {
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 508, labels: ["blocked"], body: "" }],
      deskOpen: [{ issueNumber: 508, cardId: "deploy-flip-508" }],
    });
    expect(plan.stale).toEqual([]);
  });

  it("`awaiting-fable` with a silent desk is not this rule's business", () => {
    /* Removing a Fable hold is a person's read of the card (#541 rule 3), and
       this reader must not start quietly counting it as rot. */
    const plan = planDeskHoldLabels({
      ordered: [{ issueNumber: 535, labels: ["awaiting-fable"], body: "" }],
      deskOpen: [],
    });
    expect(plan.stale).toEqual([]);
  });
});
