import { describe, expect, it } from "vitest";

import { readDelta } from "./refineDelta";
import { readStoredDelta } from "./refineLegacy";

/**
 * WALL (d) READS OUR OWN ROW, SO IT USES OUR OWN ROW'S READER (ruled fable-881 §3).
 *
 * `refineService.ts`'s wall-(d) re-read composes the render prompt from what was
 * PERSISTED rather than from the in-memory object — D-131, and the discipline
 * is right. The READER was wrong: it was `readDelta`, the strict one that
 * guards the boundary where a model's reply enters the record, pointed at the
 * boundary where our own history re-enters.
 *
 * # What it cost, and it was the lane's headline ask
 *
 * *"Give her vampire fangs"* is one ask and it is the open one, so the row is
 * `{ open: … }` and nothing else. The strict reader returns NULL for that —
 * *"an empty delta is not a delta"* — and the line below the re-read throws.
 * That throw is ABOVE the repaint/paste split, so it was not paste-road-only:
 * every road, every user, 100% of ordinary open asks. It settles into the
 * request's own catch, which refunds — the money was safe, the picture was not.
 * Sell-don't-refuse would have shipped as sell-then-refund.
 *
 * On a face with prior edits the row survives the strict reader and the open
 * kind is dropped from the composed prompt in silence, which is the worse half
 * because nothing sees it.
 *
 * # The arms below are the probe that found it, kept
 *
 * `scripts/probe-wall-d-open-disposable.mts` drove the two readers directly and
 * is what overturned the header's *"costs nothing on the road the open lane
 * runs on"*. It is a regression arm now rather than a script somebody has to
 * remember to run (fable-881 §3b).
 */

const ASK = { noun: "fangs", words: "vampire fangs" } as const;
/** The ordinary open ask: one instruction, and the open kind is all of it. */
const OPEN_ONLY = { open: { fangs: ASK } };
/** The same kind on a face that has been edited before. */
const OPEN_BESIDE_FACETS = { free: { marks: ["a small scar on her cheek"] }, open: { fangs: ASK } };
/** A row this program wrote before `hair` was split into cut/colour/texture. */
const LEGACY = { free: { hair: "a blunt fringe" } };

describe("the strict reader is the wrong reader for a persisted row", () => {
  it("NULLS the ordinary open ask — the shape that threw on every road", () => {
    expect(readDelta(structuredClone(OPEN_ONLY))).toBeNull();
  });

  it("and DROPS the open kind when other facets carry the row past the null", () => {
    const strict = readDelta(structuredClone(OPEN_BESIDE_FACETS));
    expect(strict).not.toBeNull();
    expect(strict?.free?.marks).toEqual(["a small scar on her cheek"]);
    /* The silent half: the row is readable, and the ask she paid for is gone. */
    expect(strict?.open).toBeUndefined();
  });

  it("and NULLS a legacy row, which is what wall (d) did with our own history", () => {
    expect(readDelta(structuredClone(LEGACY))).toBeNull();
  });
});

describe("our own record's reader keeps what we wrote", () => {
  it("reads the ordinary open ask", () => {
    const stored = readStoredDelta(structuredClone(OPEN_ONLY));
    expect(stored?.open?.fangs).toEqual(ASK);
  });

  it("keeps the open kind AND the facets beside it", () => {
    const stored = readStoredDelta(structuredClone(OPEN_BESIDE_FACETS));
    expect(stored?.open?.fangs).toEqual(ASK);
    expect(stored?.free?.marks).toEqual(["a small scar on her cheek"]);
  });

  it("MIGRATES the legacy row rather than throwing on it — the declared behaviour change", () => {
    /*
      Driven both ways as fable-881 §3a required. Before: the strict reader
      nulled this and wall (d) threw, so a customer with an old enough chain met
      "the refinement was not recorded in a readable shape" and a refund. After:
      the retired subject is translated into today's vocabulary and the render
      composes with it.

      The after-behaviour is the defensible one, and the reason is that the
      throw was never a judgement about this row. It was the strict reader
      refusing a vocabulary that predates it — which is precisely what
      `readStoredDelta` was written to stop, one boundary over.
    */
    const stored = readStoredDelta(structuredClone(LEGACY));
    expect(stored).not.toBeNull();
    /* `hair` is gone as a key, and its words survive under a subject that exists. */
    expect((stored?.free as Record<string, unknown> | undefined)?.hair).toBeUndefined();
    expect(JSON.stringify(stored?.free)).toContain("a blunt fringe");
  });

  it("still refuses a row it genuinely cannot read", () => {
    /*
      The negative control, and it is what makes the arms above mean anything:
      a reader that returned something for everything would pass all of them
      while removing the guard entirely. An open kind carried out of a row whose
      other content was rejected is D-182's defect in a new coat.
    */
    expect(readStoredDelta({ free: { marks: 42 }, open: { fangs: ASK } })).toBeNull();
    expect(readStoredDelta({ open: { fangs: { noun: "", words: "" } } })).toBeNull();
  });
});
