/**
 * THE COVERAGE OWNER (item 7a, countersigned fable-1368).
 *
 * Three properties, and the first is the compatibility contract the whole
 * landing rests on: with `CASTING_TWO_PATHS_SCOPE` absent every roll in
 * production is `unpathed`, so if these answers are not today's frozen tables
 * byte for byte, this "dark" landing changed the product.
 */
import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";

import {
  bareSurfaces,
  coverageOfWardrobeLine,
  wardrobeCoversSurface,
} from "./inkSurfaceCoverage";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";

describe("what this cast's wardrobe leaves showing", () => {
  it("⚠ an UNPATHED roll answers exactly the three constants this replaces", () => {
    /*
      The tables at the moment of the swap, quoted rather than referenced:

        RIDES_PACKAGE_VIEWS   neck true · upperArm true · upperChest false
        INK_PLACEMENTS.skin   bare     · bare          · dependsOnGarment

      Every one of the 206 production rolls is `unpathed` as this lands, so this
      arm IS the claim that nothing moved for anybody.
    */
    const resolution = { kind: "unpathed" } as const;
    expect(wardrobeCoversSurface(resolution, "neck")).toBe("bare");
    expect(wardrobeCoversSurface(resolution, "upperArm")).toBe("bare");
    expect(wardrobeCoversSurface(resolution, "upperChest")).toBe("covered");
  });

  it("a Cast with no line recorded answers the same — that is what null means", () => {
    expect(coverageOfWardrobeLine(null, "neck")).toBe("bare");
    expect(coverageOfWardrobeLine(null, "upperChest")).toBe("covered");
  });

  it("the HOUSE line is the house table, and it is matched as a value not a guess", () => {
    expect(coverageOfWardrobeLine(HOUSE_WARDROBE_LINE, "neck")).toBe("bare");
    expect(coverageOfWardrobeLine(HOUSE_WARDROBE_LINE, "upperArm")).toBe("bare");
    expect(coverageOfWardrobeLine(HOUSE_WARDROBE_LINE, "upperChest")).toBe("covered");
    /* Stored lines are trimmed on the way in; a trailing space is the same
       outfit and must not fall to `unknown`. */
    expect(coverageOfWardrobeLine(`  ${HOUSE_WARDROBE_LINE}  `, "upperChest")).toBe("covered");
  });

  it("⚠ BASICS leaves the chest bare — which is the whole point of the path", () => {
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      for (const placement of INK_PLACEMENTS) {
        expect(coverageOfWardrobeLine(line, placement), `${line} / ${placement}`).toBe("bare");
      }
    }
  });

  it("⚠ AN OUTFIT NOBODY HAS READ IS `unknown` — never `bare`, and never `covered`", () => {
    /*
      The over-promising direction is the dangerous one. `covered` refuses a
      capability; `bare` SELLS one, and a neck tattoo sold onto a roll-neck
      jumper rides all six package views and fails the wardrobe axis on every
      one — six refunded slices.

      And `unknown` is not `covered` either, because the refusal a customer
      reads must say which of the two it is (ruling 1).
    */
    const jumper = "a charcoal roll-neck jumper, dark jeans and boots";
    for (const placement of INK_PLACEMENTS) {
      expect(coverageOfWardrobeLine(jumper, placement)).toBe("unknown");
    }
  });

  it("CONTROL — no prose matching: a line that DESCRIBES a crew tee is still unknown", () => {
    /*
      Without this arm the module is free to grow a `.includes("crew")` and read
      as though it were answering. A guess about what a customer's outfit covers
      is a guess about her body, and the reader that can answer honestly is
      7a-bis. Only lines this product WROTE are known.
    */
    expect(coverageOfWardrobeLine("a plain crew-neck tee", "upperChest")).toBe("unknown");
    expect(coverageOfWardrobeLine("shirtless", "upperChest")).toBe("unknown");
  });

  it("⚠ `incoherent` is unknown and not covered", () => {
    /* A roll that claims a path and cannot say what it is wearing has told us
       nothing about its chest. Reporting that as a covering is the lie. */
    const resolution = { kind: "incoherent", path: "wardrobe" } as const;
    for (const placement of INK_PLACEMENTS) {
      expect(wardrobeCoversSurface(resolution, placement)).toBe("unknown");
    }
  });

  it("a resolved line goes through the same door as a bare string", () => {
    const basics = basicsWardrobeLine("male");
    expect(wardrobeCoversSurface(
      { kind: "line", line: basics, source: "born", path: "basics" },
      "upperChest",
    )).toBe("bare");
    expect(wardrobeCoversSurface(
      { kind: "line", line: HOUSE_WARDROBE_LINE, source: "born", path: "wardrobe" },
      "upperChest",
    )).toBe("covered");
  });

  it("names the surfaces that work, for the sentences that must not be frozen", () => {
    const worn = (line: string): { kind: "line"; line: string; source: "born"; path: "wardrobe" } =>
      ({ kind: "line", line, source: "born", path: "wardrobe" });
    /* Absent is silence, which is `unpathed`: the house crew tee. */
    expect(bareSurfaces(undefined)).toEqual(["neck", "upperArm"]);
    expect(bareSurfaces({ kind: "unpathed" })).toEqual(["neck", "upperArm"]);
    expect(bareSurfaces(worn(basicsWardrobeLine("male")))).toEqual([...INK_PLACEMENTS]);
    expect(bareSurfaces(worn("a charcoal roll-neck jumper"))).toEqual([]);
    /* And an incoherent branch offers NOTHING rather than the crew tee's two. */
    expect(bareSurfaces({ kind: "incoherent", path: "basics" })).toEqual([]);
  });
});
