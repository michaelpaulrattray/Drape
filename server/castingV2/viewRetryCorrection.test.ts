/**
 * THE RETRY'S CORRECTION, DRIVEN DIRECTLY — #1492 shape A.
 *
 * The clause is composed by a pure function on purpose, so the decisions that
 * matter can be driven without a render, a judge or a credit. What is on trial
 * here is WHEN it speaks and WHAT it says; that it actually reaches the
 * outgoing request is on trial at the wire, in `packageOrchestrator.test.ts`,
 * because a contract about what gets SENT is proven on the request (invariant 5).
 *
 * ⚠ **The arms that matter most are the SILENT ones.** A clause that speaks
 * when it should not is a first attempt being told it has already failed, and
 * an `unjudged` verdict fed back would describe our own outage to a drawing
 * engine. Both are failures a green render would never show.
 */
import { describe, expect, it } from "vitest";

import type { ViewConformanceVerdict } from "./viewConformance";
import { viewAngleCorrectionClause } from "./viewRetryCorrection";

type AxisWord = "matches" | "differs" | "unsure";

function verdict(
  angle: { verdict: AxisWord; note?: string },
  over: Partial<ViewConformanceVerdict> = {},
): ViewConformanceVerdict {
  return {
    pass: angle.verdict === "matches",
    method: "judge:test",
    axes: {
      identity: { pass: true, note: "same person", verdict: "matches" },
      angle: { pass: angle.verdict === "matches", note: angle.note ?? "", verdict: angle.verdict },
      wardrobe: { pass: true, note: "", verdict: "matches" },
    },
    ...over,
  };
}

describe("the retry's framing correction", () => {
  it("says NOTHING on a first attempt — there is nothing yet to correct", () => {
    expect(viewAngleCorrectionClause(undefined, "threeQuarter")).toBe("");
  });

  it("says NOTHING when the previous attempt's angle passed", () => {
    /*
      The attempt before may have failed on identity or wardrobe and still had
      its camera right. Escalating the framing there would tell the engine to
      change the one thing that was correct.
    */
    expect(viewAngleCorrectionClause(verdict({ verdict: "matches" }), "sideClose")).toBe("");
  });

  it("says NOTHING on an UNSURE angle — that note is about the reader, not the picture", () => {
    /*
      `unsure` fails the axis (§I, fail closed), so this arm is NOT redundant
      with the one above: the previous attempt really was refused. What it has
      is a note saying the reader could not tell, and there is nothing in that
      for an engine to act on.
    */
    const unsure = verdict({ verdict: "unsure", note: "the crop is too tight to tell" });
    expect(unsure.axes.angle.pass).toBe(false);
    expect(viewAngleCorrectionClause(unsure, "sideClose")).toBe("");
  });

  it("says NOTHING on an UNJUDGED verdict — an outage is not a defect in the picture", () => {
    /*
      ⚠ The money arm of this module. A fail-closed default's note is one of
      OUR sentences — "the conformance judge could not be reached", "our judging
      account is out of funds" — and pasting it into a drawing instruction would
      be describing our own plumbing to the engine about a picture that may have
      been perfect.
    */
    const outage = verdict(
      { verdict: "differs", note: "the conformance judge could not be reached" },
      { unjudged: true },
    );
    expect(viewAngleCorrectionClause(outage, "threeQuarter")).toBe("");
  });

  it("carries the reviewer's own words, and fixes what they MEAN", () => {
    const mirrored = "The head is turned toward the subject's right (nose toward left edge) "
      + "rather than the specified left-turn with nose toward the right edge.";
    const clause = viewAngleCorrectionClause(verdict({ verdict: "differs", note: mirrored }), "threeQuarter");

    // His own Jingu's note, verbatim, because the engine needs the specific fault.
    expect(clause).toContain(mirrored);
    // Loud that the last attempt was thrown away, so this reads as a correction.
    expect(clause).toContain("WAS REJECTED ON ITS CAMERA ANGLE");
    /*
      ⚠ THE SENTENCE THAT MAKES THE QUOTE SAFE. Without it the note is read as
      guidance rather than as evidence — see the hedge arm below.
    */
    expect(clause).toContain("describes the picture that was THROWN AWAY, not the picture to draw");
    // It points at the instruction already in the prompt instead of writing a new one.
    expect(clause).toContain("Follow the framing instruction above exactly");
    // And it closes the scope, so "change the angle" is not read as "redraw her".
    expect(clause).toContain("Nothing else about this person, their outfit or the light changes");
  });

  it("⚠ WRAPS A HEDGING NOTE RATHER THAN REPEATING IT AS ADVICE", () => {
    /*
      This note is REAL — the #1414 court caught the judge writing it while
      refusing the frame: "...suggesting a slightly less than full 90-degree
      turn; largely matches intent though."

      Pasted in as guidance it tells the engine its rejected attempt was
      basically fine, which is the opposite of an escalation. The clause cannot
      stop a model hedging; what it can do is never present the hedge as the
      instruction, and that is what this arm holds.
    */
    const hedged = "The face is turned close to a true profile but both eyebrow and part of the "
      + "far eye area are still slightly visible, suggesting a slightly less than full 90-degree "
      + "turn; largely matches intent though.";
    const clause = viewAngleCorrectionClause(verdict({ verdict: "differs", note: hedged }), "sideClose");

    const quoteAt = clause.indexOf(hedged);
    const framingAt = clause.indexOf("THROWN AWAY");
    expect(quoteAt).toBeGreaterThan(-1);
    // The sentence that reframes it comes AFTER the quote, so it has the last word.
    expect(framingAt).toBeGreaterThan(quoteAt);
  });

  it("names a close-up a CLOSE-UP, in the words a photographer uses", () => {
    /*
      Working law 8 — the user's ontology governs. "The angle axis failed" is
      this pipeline's vocabulary; nothing this engine reads uses it.
    */
    const clause = viewAngleCorrectionClause(
      { ...verdict({ verdict: "differs", note: "crop cuts the chin" }) },
      "closeUp",
    );
    expect(clause).toContain("THE PREVIOUS ATTEMPT AT THIS CLOSE-UP");
    expect(clause).not.toContain("axis");
    expect(clause).not.toContain("conformance");
  });

  it("still escalates when the reviewer left no note at all", () => {
    /*
      The note is optional in the judge's schema, so a refusal with an empty one
      is reachable. Falling silent there would turn the retry back into the
      re-roll this card is about — the engine still learns the camera was wrong.
    */
    const clause = viewAngleCorrectionClause(verdict({ verdict: "differs", note: "" }), "sideClose");
    expect(clause).toContain("WAS REJECTED ON ITS CAMERA ANGLE");
    expect(clause).toContain("Follow the framing instruction above exactly");
    // With nothing to quote, it must not quote emptiness at it.
    expect(clause).not.toContain("The reviewer wrote");
  });

  it("makes a note safe to quote without making it say something else", () => {
    /*
      A newline inside the quotation would let the note read as its own
      paragraph of instructions, and a double quote would close the quotation
      early and leave the rest of the sentence loose in the prompt. Both are
      neutralised; the WORDS are untouched, including the hedge.
    */
    const messy = 'Crop is too tight,\n\ncutting off the "chin" and mouth apparatus   at the bottom.';
    const clause = viewAngleCorrectionClause(verdict({ verdict: "differs", note: messy }), "closeUp");

    expect(clause).toContain("Crop is too tight, cutting off the chin and mouth apparatus at the bottom.");
    expect(clause.split("\n")).toHaveLength(1);
    // Exactly the two quotes this clause opens and closes with, and no more.
    expect(clause.split('"')).toHaveLength(3);
  });

  it("clamps a runaway note rather than dropping it", () => {
    /*
      The judge's schema caps a note at 400 characters, so this is a bound at
      the point of USE rather than a second opinion about length — this module
      must not depend on a cap declared in a file it does not own. Cut, never
      dropped: a truncated description of the defect still names the defect,
      and dropping it silently is how a correction turns back into a re-roll.
    */
    const runaway = "x".repeat(4_000);
    const clause = viewAngleCorrectionClause(verdict({ verdict: "differs", note: runaway }), "sideClose");
    expect(clause).toContain("The reviewer wrote");
    expect(clause.length).toBeLessThan(1_000);
    expect(clause).toContain("…");
  });
});
