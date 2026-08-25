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

  it("BASICS leaves the neck and the upper arm bare", () => {
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      for (const placement of ["neck", "upperArm"] as const) {
        expect(coverageOfWardrobeLine(line, placement), `${line} / ${placement}`).toBe("bare");
      }
    }
  });

  it("⚠ BASICS's CHEST is `bare` — EARNED by three courts and a founder answer", () => {
    /*
      This entry said `bare` from the day it was written, off the spec's own
      sentence (*"scooped low at the chest"*), and the file said so honestly:
      *the one entry here that has not been through a frame.* It has now.

      The Two Paths court rolled eight Basics candidates (opus-1111) and asked
      `upper chest` — the mint's own measured word, the one that decides whether
      a chest piece can be cropped and carried at all. **0 px on 4 of 4.**
      `chest skin` and `chest` also 0 px. Her skin is plainly visible and the
      reader will not name it.

      `bare` would SELL a chest piece the mint cannot crop — it renders, nothing
      is recorded, and it is gone on her next edit. `covered` would be the lie
      ruling 1 forbids. So `unknown`, which fails closed and says in each
      consumer's own words that nobody can answer for this outfit.

      ✅ **AND IT FLIPPED, 2026-08-23, ON THE OTHER HALF OF ITS OWN CONDITION.**
      The founder lowered the spec's scoop to name the collarbones and the
      sternum rather than a degree (FQ-b), and the re-court read the amended
      frames with the SAME word:

      ```
      round 1  "scooped low at the chest"    0 px on 4 of 4
      round 2  the amended spec              4 of 4, 3.9–6.0% of frame
      round 3  the same spec, second sheet   4 of 4, 5.0–7.6%
      round 4  a deliberately milder wording 4 of 4, 4.6–6.4%
      ```

      **Twelve of twelve on three independent sheets and two wordings**, with
      the masks opened and looked at — collarbone to sternum, clean-edged, none
      of the garment.

      ⚠ **THE ORDER OF THE TWO CLAUSES IS THE POINT AND IS ASSERTED BELOW.** The
      condition was never *a court reads the chest*; it was *he lowers it AND a
      court reads it*, and for the hours between the court and his answer only
      one had happened. The value did not move then. It moved in the commit that
      carried *"framing is fine and so is everything else"* (relayed
      fable-1465), which also carries the ~1-in-4 vendor refusal rate the
      lowered neckline costs — recorded beside the spec sentence so a reader
      meets that trade as decided rather than discovering it.
    */
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      expect(coverageOfWardrobeLine(line, "upperChest"), line).toBe("bare");
    }
    /* ⚠ AND THE SENTENCE IT WAS EARNED ON IS PINNED WITH IT. `bare` here is a
       claim about a SPECIFIC garment that a court read; if the spec's neckline
       is ever raised again this value is a lie the moment the string changes,
       and nothing else in the file would notice. Both landmarks, because they
       are what the court measured. */
    expect(basicsWardrobeLine(null)).toMatch(/collarbone/);
    expect(basicsWardrobeLine(null)).toMatch(/sternum/);
    /* The male form needs no landmark — it is `bare chested`, and the chest is
       bare by the absence of a garment rather than by the cut of one.

       ⚠ It said `shirtless` until 2026-08-25 and the swap was the founder's own
       wording test, for the provider's PROMPT checker and not for the picture
       (`wardrobeLine.ts`). The negative pin below is the half that matters: the
       retired word must not creep back, because it costs a slice in four. */
    expect(basicsWardrobeLine("male")).toContain("bare chested");
    expect(basicsWardrobeLine("male")).not.toContain("shirtless");
  });

  it("⚠ AN OUTFIT NOBODY HAS READ IS `unknown` — never `bare`, and never `covered`", () => {
    /*
      The over-promising direction is the dangerous one. `covered` refuses a
      capability; `bare` SELLS one, and a neck tattoo sold onto a roll-neck
      jumper rides all five package views and fails the wardrobe axis on every
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

  it("⚠ A RETIRED BASICS SENTENCE KEEPS ITS COVERAGE — two production rolls wear one", () => {
    /*
      The arm bought by the `shirtless` → `bare chested` swap (fable-1659 §1),
      and it is a law-7-second-half arm rather than a feature arm.

      `BASICS_LINES` is DERIVED from `basicsWardrobeLine`, which is right — but
      derivation tracks what we write NEXT and a stored roll records what we
      wrote THEN. Production rolls **#215 and #216** were already stamped with
      the male form's old sentence when it changed. Without
      `RETIRED_BASICS_LINES` they stop matching and every surface on those two
      casts falls from `bare` to `unknown` — the chest, neck and upper arm of
      two casts the founder is actively rolling, with no failing test and no
      error anywhere.

      It is written as the STORED STRING rather than through the writer on
      purpose: a retired line has no writer left to ask, and an arm that asked
      one would be asserting the thing it is meant to catch.
    */
    const retiredMaleForm = "shirtless, in plain black fitted shorts, barefoot";
    for (const placement of INK_PLACEMENTS) {
      expect(coverageOfWardrobeLine(retiredMaleForm, placement), placement)
        .toBe(coverageOfWardrobeLine(basicsWardrobeLine("male"), placement));
    }
    /* And it is `bare` rather than merely equal — an arm comparing two `unknown`s
       would pass while the whole point was lost. */
    expect(coverageOfWardrobeLine(retiredMaleForm, "upperChest")).toBe("bare");
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
      "upperArm",
    )).toBe("bare");
    /* The chest goes through the same door and comes back with the court's
       answer rather than the spec's — `bare` since the re-court read it 12 of
       12 and the founder closed the trade. */
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
    /* ⚠ ALL THREE ON BASICS, and this line has now said two different things
       in one day — which is exactly what it is for. It named two while the
       court had read the chest at 0 px; the lowered scoop was read at 12 of 12
       and the founder closed it, so the sentence a Basics customer is told now
       names the chest as well. **That is the one placement the path exists to
       unlock**, and this is the assertion that says the promise reaches her. */
    expect(bareSurfaces(worn(basicsWardrobeLine("male"))))
      .toEqual(["neck", "upperArm", "upperChest"]);
    expect(bareSurfaces(worn(basicsWardrobeLine(null))))
      .toEqual(["neck", "upperArm", "upperChest"]);
    /* CONTROL — the house tee still names two, so the three above are a fact
       about the Basics line and not about the reader having stopped filtering. */
    expect(bareSurfaces(worn(HOUSE_WARDROBE_LINE))).toEqual(["neck", "upperArm"]);
    expect(bareSurfaces(worn("a charcoal roll-neck jumper"))).toEqual([]);
    /* And an incoherent branch offers NOTHING rather than the crew tee's two. */
    expect(bareSurfaces({ kind: "incoherent", path: "basics" })).toEqual([]);
  });
});
