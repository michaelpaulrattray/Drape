/**
 * THE PACKAGE SLOTS ARE ONE LIST, AND THE ORDER IS HALF OF IT.
 *
 * `shared/boardTypes.ts` declares the comp-card six twice on purpose:
 * `CANONICAL_VIEW_ANGLES` in the order the exports, the PDF cells and the
 * `z.enum` inputs depend on, and `PACKAGE_SLOTS` in D-39's clusters — face
 * first, then body — which is the order a customer sees on the strip.
 *
 * Two orderings of one closed set is a real thing to want, and it is also
 * exactly the shape that rots. So it is pinned as a PERMUTATION: same members,
 * deliberately different order.
 *
 * TWO, and not three: `shared/exportViews.ts`'s `COMP_CARD_VIEW_ORDER` is an
 * ALIAS of `PACKAGE_SLOTS` as of 2026-08-24 and no longer a third literal
 * (fable-1511 §1). **The literal spelling of the presentation order lives here
 * and nowhere else** — that is what makes this file's order arm worth having,
 * and `server/exportViews.test.ts` asserts the identity rather than repeating
 * the six. If a second literal of these six ever reappears anywhere,
 * `scripts/sweep-handwritten-vocabularies.mts` is what finds it.
 *
 * # Why this file exists (triage §29d, ruled fable-1509 §2)
 *
 * Until 2026-08-24 `PACKAGE_SLOTS` was `= CANONICAL_VIEW_ANGLES` and nothing
 * imported it, while `ViewTabs.tsx` hand-wrote its own array of the same six
 * under the same name and drew the strip from that. A second list shadowing a
 * source of truth is working law 4, and **the two had already drifted**:
 * `frontFull` and `sideClose` sat in opposite positions.
 *
 * Nothing was broken, because membership still agreed — and that is precisely
 * why it needed a test rather than a fix and a hope. The family's own docblock
 * carries what the failure costs when membership DOES move: iterating the wrong
 * six is how package v3's close-up came to be generated, charged, refunded and
 * then silently dropped from the room.
 *
 * The ORDER arm is the one that would have caught the state this file was
 * written in. The MEMBERSHIP arm is the one that catches a seventh slot.
 */
import { describe, expect, it } from "vitest";

import {
  CANONICAL_VIEW_ANGLES,
  PACKAGE_SLOTS,
  VIEW_ANGLE_LABELS,
  type CanonicalViewAngle,
} from "../shared/boardTypes";

describe("PACKAGE_SLOTS is a deliberate permutation of the comp-card six", () => {
  it("holds exactly the same members as CANONICAL_VIEW_ANGLES", () => {
    expect([...PACKAGE_SLOTS].sort()).toEqual([...CANONICAL_VIEW_ANGLES].sort());
  });

  it("names each slot exactly once", () => {
    expect(new Set(PACKAGE_SLOTS).size).toBe(PACKAGE_SLOTS.length);
  });

  /**
   * The clusters, spelled out rather than derived from the constant under test
   * — a test that recomputes its subject asserts nothing. These six literals
   * are what the strip shows and what D-39 ratified.
   */
  it("is ordered face cluster then body cluster", () => {
    expect([...PACKAGE_SLOTS]).toEqual([
      "frontClose",
      "threeQuarter",
      "sideClose",
      "frontFull",
      "sideFull",
      "backFull",
    ]);
  });

  /**
   * The pin that makes the two constants worth having separately. If someone
   * "tidies" `PACKAGE_SLOTS` back into an alias of `CANONICAL_VIEW_ANGLES`,
   * this is what says no — and it is a real difference today, not a hypothetical
   * one: positions 3 and 4 are swapped between them.
   */
  it("differs from CANONICAL_VIEW_ANGLES in ORDER, which is the point", () => {
    expect([...PACKAGE_SLOTS]).not.toEqual([...CANONICAL_VIEW_ANGLES]);
    const differing = PACKAGE_SLOTS
      .map((slot, index) => (slot === CANONICAL_VIEW_ANGLES[index] ? null : index))
      .filter((index): index is number => index !== null);
    expect(differing).toEqual([2, 3]);
  });

  it("every slot has a long label, so no surface can draw an unnamed one", () => {
    for (const slot of PACKAGE_SLOTS) {
      expect(VIEW_ANGLE_LABELS[slot as CanonicalViewAngle], slot).toBeTruthy();
    }
  });
});
