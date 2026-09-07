import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CANDIDATE_FAILURE_KINDS,
  CANDIDATE_FAILURE_LINES,
  CANDIDATE_FAILURE_REFUNDED,
} from "@shared/candidateFailure";

/**
 * THE REFUNDED PILL, AND THE ONE TILE THAT MUST NOT WEAR IT (#553).
 *
 * The founder, with a frame of a failed tile: *"on a failed generation it says
 * content filter tag but maybe in the top right could it also say refunded or
 * something as a tag also?"*
 *
 * The refund was already on the tile — in the caption, in a sentence, after the
 * reason. This makes it a glance.
 *
 * ⚠ The card asked for it *"derived from `status`, never from the failure
 * kind"*, and that rule taken literally is WRONG: `unpaid` is a
 * `failed-refunded` tile that was never charged, and its own line says so.
 * A REFUNDED pill sitting over "Didn't start · not charged" is a claim about
 * money contradicting the sentence beneath it. So the pill reads the refund
 * FACT, and this suite's first arm is the one that matters — it holds that
 * fact against the sentence, for every kind, with a reader that does not share
 * the map's resolver.
 */
describe("the refunded pill says only what the money did", () => {
  it("agrees with the line every kind already shows — read from the lines, not from the map", () => {
    /*
      The second reader. `CANDIDATE_FAILURE_REFUNDED` is a second statement of
      something the LINES imply (working law 4), so it is never allowed to
      simply be trusted: the expectation here is computed from the sentence the
      customer actually reads, and a kind whose line stops claiming a refund
      while its boolean stays true reddens.
    */
    for (const kind of CANDIDATE_FAILURE_KINDS) {
      const line = CANDIDATE_FAILURE_LINES[kind];
      const lineClaimsRefund = line.includes("· refunded");
      expect(CANDIDATE_FAILURE_REFUNDED[kind], `${kind}: "${line}"`).toBe(lineClaimsRefund);
    }
  });

  it("is FALSE for the kind that was never charged, named rather than derived", () => {
    /*
      A positive control for the arm above, because that arm would pass on a
      table where every value happened to be true if every line happened to
      claim a refund. This names the specimen: `unpaid` exists precisely
      because one failure road never took the money.
    */
    expect(CANDIDATE_FAILURE_REFUNDED.unpaid).toBe(false);
    expect(CANDIDATE_FAILURE_LINES.unpaid).toContain("not charged");
    expect(CANDIDATE_FAILURE_LINES.unpaid).not.toContain("refunded");
  });

  it("covers every kind — a new failure road cannot ship without answering this", () => {
    for (const kind of CANDIDATE_FAILURE_KINDS) {
      expect(typeof CANDIDATE_FAILURE_REFUNDED[kind], `${kind} has no refund answer`).toBe(
        "boolean",
      );
    }
  });

  it("draws the pill only where that fact is true, and at the opposite corner", async () => {
    const tile = await readFile(
      new URL("./components/CandidateTile.tsx", import.meta.url),
      "utf8",
    );
    // Gated on the fact, never on the status alone — the whole correction above.
    expect(tile).toContain('CANDIDATE_FAILURE_REFUNDED[failure?.kind ?? "unknown"]');
    expect(tile).toContain('className="dpc-tile__chip dpc-tile__chip--refunded"');

    const css = await readFile(new URL("./castingV2.css", import.meta.url), "utf8");
    const at = css.indexOf(".dpc-tile__chip--refunded {");
    expect(at, "the refunded pill's rule must exist to be read").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    // Diagonally opposite the reason chip, which is left/bottom — so the two
    // can never collide however long either label gets.
    expect(rule).toContain("right: 8px");
    expect(rule).toContain("top: 8px");
    expect(rule).toContain("left: auto");
    expect(rule).toContain("bottom: auto");
    // Monochrome: a refund is a status, not good news to be coloured in.
    expect(rule).not.toMatch(/background|color:/);
  });
});
