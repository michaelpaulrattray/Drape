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
