import { describe, expect, it } from "vitest";

import {
  MASKED_EDITING_SCOPE,
  additionDestination,
  maskedEditingEnabledFor,
  regionNameOf,
} from "./maskedRefine";
import { allFacets } from "./refineFacets";
import { hasRegion, zoneScopeOf } from "./zoneScope";
import { type Mask } from "./maskedComposite";

/**
 * WHAT IS LEFT OF THE MASKED-EDITING SUITE (#2859).
 *
 * The masked-edit harvest — and the fringe, territory, edge and reveal
 * machinery only it read — was deleted on his word *"delete dead code"*, and
 * every arm that drove it went with it. Each arm below was read on its own and
 * kept because its subject still has a reader of its own: the scope flag, the
 * facet-to-question table and the addition corridor. The accessory-word arms
 * moved to `accessoryKinds.test.ts`, the table they were always about.
 */

const W = 64;
const H = 64;

describe("the scope is one account, and everyone else is on the old path", () => {
  it("is scoped to a named user, never to everyone", () => {
    /* A boolean would make "on for me" and "on for everyone" the same edit, and
       that is exactly the decision that deserves two. Same grammar and the same
       parser as CASTING_V2_SCOPE — a second scope grammar would be a mirror
       (law #4). Widening is a separate founder call. */
    expect(MASKED_EDITING_SCOPE).toMatch(/^(off|users:[1-9][0-9,]*)$/);
    expect(MASKED_EDITING_SCOPE, "never flipped straight to everyone").not.toBe("all");
  });

  it("leaves every other account exactly where it was", () => {
    /* The half that matters on a scoped flip: the blast radius is one id. */
    expect(maskedEditingEnabledFor(2)).toBe(false);
    expect(maskedEditingEnabledFor(999)).toBe(false);
    expect(maskedEditingEnabledFor(undefined), "and an unattributed render never opts in").toBe(false);
  });
});

describe("the segmentation question is named per facet, never invented", () => {
  /*
    An ADDITION is a facet whose zone scope is `object`: the thing is not there
    yet, so nothing can segment it (D-213). This used to read a one-line
    helper deleted with the harvest it served (#2859) — so the scope is asked
    directly here, which is all that helper ever did.
  */
  const isAddition = (facet: ReturnType<typeof allFacets>[number]) => zoneScopeOf(facet) === "object";

  it("gives every SEGMENTABLE facet a question to ask", () => {
    /* D-213: a segmenter is never asked an open question, so a facet whose
       region is read off her current picture must have a written prompt rather
       than a derived one. */
    const missing = allFacets().filter((facet) =>
      hasRegion(facet) && !isAddition(facet) && regionNameOf(facet) === null);
    expect(missing).toEqual([]);
  });

  it("gives ADDITIONS none, because the thing is not there to segment", () => {
    /* An earring's destination comes from a landmark and the described object's
       extent — segmenting the master for it would be asking where a thing is
       that nobody is wearing. */
    const additions = allFacets().filter(isAddition);
    /* `horns` is the third, and for the same reason: they arrive through an
       edit, so segmenting the MASTER for them asks where a thing is that she
       does not have. The detection court reads them on the DELIVERED frame,
       which is a different picture and a different question. */
    expect(additions.sort()).toEqual(["horns", "ink", "statedAccessories"]);
    for (const facet of additions) expect(regionNameOf(facet)).toBeNull();
  });
});

describe("an addition is placed from landmarks, and scaled by her own face", () => {
  const at = (mask: Mask, x: number, y: number) => mask.data[y * W + x];

  it("builds one corridor per landmark — two ears, two questions", () => {
    const both = additionDestination({
      landmarks: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    expect(at(both, 16, 32), "her right lobe").toBeGreaterThan(0);
    expect(at(both, 48, 32), "her left lobe").toBeGreaterThan(0);
    expect(at(both, 32, 32), "and nothing in between").toBe(0);
  });

  it("hangs a drop below the anchor without widening it", () => {
    const stud = additionDestination({ landmarks: [{ x: 0.5, y: 0.3 }], width: W, height: H, dropSteps: 0 });
    const drop = additionDestination({ landmarks: [{ x: 0.5, y: 0.3 }], width: W, height: H, dropSteps: 6 });
    let studPx = 0; let dropPx = 0;
    for (let i = 0; i < stud.data.length; i += 1) { if (stud.data[i]) studPx += 1; if (drop.data[i]) dropPx += 1; }
    expect(dropPx, "a drop reaches further than a stud").toBeGreaterThan(studPx);
    expect(at(drop, 32, 30), "and still starts at the lobe").toBeGreaterThan(0);
  });

  it("takes its scale from the distance between the landmarks, not a constant", () => {
    /* A face filling the frame and one far away must get proportionate studs. */
    const near = additionDestination({
      landmarks: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    const far = additionDestination({
      landmarks: [{ x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }], width: W, height: H, dropSteps: 0,
    });
    let nearPx = 0; let farPx = 0;
    for (let i = 0; i < near.data.length; i += 1) { if (near.data[i]) nearPx += 1; if (far.data[i]) farPx += 1; }
    expect(nearPx, "a wider head gets larger studs").toBeGreaterThan(farPx);
  });

  it("refuses to place an addition with no landmark at all", () => {
    expect(() => additionDestination({ landmarks: [], width: W, height: H })).toThrow(/needs a landmark/);
  });

  it("gives the regionless facet none", () => {
    /* expression routes full-frame; a region prompt for it would be a lie. */
    expect(regionNameOf("expression")).toBeNull();
  });
});
