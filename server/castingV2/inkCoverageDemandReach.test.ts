/**
 * ⚠ WHICH COVERAGE REFUSALS ARE ACTUALLY REACHABLE — and a correction to
 * migration 0052's own docblock, driven rather than argued.
 *
 * # The claim, and why it is not true today
 *
 * `drizzle/0052_ink_form_demand_paths.sql` says, under the heading
 * *"`pathAtRefusal` IS NULLABLE AND WILL NEVER BE NULL IN PRACTICE"*:
 *
 * > *"BOTH VALUES ARE REACHABLE, which is what makes the column worth having
 * > rather than a constant wearing a column's clothes. `wardrobe` is the
 * > covered-chest case; `basics` is reachable too, because the Two Paths court
 * > found that a Basics cast's chest reads 0 px on 4 of 4 candidates, so that
 * > path answers `unknown` and fails closed."*
 *
 * The reasoning is sound about the COVERAGE and wrong about the ROUTE, and the
 * step it skips is one door further on. `upperChest` is not a placement the
 * words road serves, so a chest ask never reaches the coverage branch at all:
 * it falls through to the uncarried loop, where an outfit that does not cover
 * it produces `road_cannot_keep` — *this road cannot crop a result there* — a
 * fact about US, identical on every path and every outfit, and correctly not a
 * wardrobe demand. Meanwhile a Basics line leaves `neck` and `upperArm` bare,
 * so those RENDER. **So no Basics cast can produce a coverage refusal today**,
 * and `pathAtRefusal: "basics"` is unreachable.
 *
 * Measured by driving `classifyInkPlacement` over both paths and both spellings
 * (opus-1118), not read off the tables.
 *
 * # Why the column is still worth having, and what opens the second value
 *
 * The sentence that should have been written is narrower and names a live road:
 * **`basics` becomes reachable the day `upperChest` joins the served set** —
 * the court in fable-1296 §3, which is exactly what `WORDS_ROAD_PLACEMENTS_OPEN`
 * is waiting on. On that day a Basics chest ask reaches the coverage branch,
 * `BASICS_COVERAGE.upperChest` answers (`unknown` today, and FQ-b may make it
 * `bare`), and an `unknown` there is a `surfaceCoverageUnread` row on the
 * Basics path.
 *
 * ⚠ **THE MIGRATION FILE IS NOT EDITED, AND THAT IS DELIBERATE.** It has been
 * applied in both worlds; the file is the record of what was run, and editing
 * an applied migration — even its prose — makes that record something to be
 * re-read rather than trusted. The correction lives here, where the fact is
 * driven, and in `shared/inkFormDemand.ts`, where the next person changing the
 * vocabulary will be standing.
 *
 * # What this file is NOT
 *
 * Not a fence. Every arm below is a READING of today's routing, written so the
 * day the routing changes somebody has to come and read this paragraph rather
 * than discovering the widening in a demand report. **When `upperChest` joins
 * the served set, these arms go red and the correct repair is to rewrite them,
 * not to relax them** — the tense changes, the claim above becomes true, and
 * both are worth one commit's attention.
 */
import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { classifyInkPlacement } from "./inkPlacement";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import type { WardrobeResolution } from "./wardrobeLine";

const born = (path: "wardrobe" | "basics", line: string): WardrobeResolution =>
  ({ kind: "line", line, source: "born", path });

/** A picked outfit nobody has read the coverage of — `unknown` on every
 *  surface, which is every customer-named and every engine-picked line. */
const UNREAD = "a one-shoulder animal hide, bare legs, bare feet";

/** Both spellings the classifier matches, for each surface it can refuse on. */
const ASK = {
  chest: "a small swallow tattoo on her upper chest",
  neck: "a small swallow tattoo on her neck",
  arm: "a small swallow tattoo on her upper arm",
} as const;

/** Driven at BOTH settings of the words road, because a routing claim that is
 *  true at one and false at the other is not a routing claim. */
const bothRoads = (text: string, wardrobe: WardrobeResolution) =>
  [true, false].map((open) => classifyInkPlacement(text, "ink", open, wardrobe).kind);

describe("the two counted refusals, and where they can actually come from", () => {
  it("⚠ a WARDROBE cast in the house line is `not_carried` — the counted covering", () => {
    /* §4 case (c): a Wardrobe brief naming no outfit falls back to the grey
       tee, whose upper chest is covered — measured, not assumed. */
    expect(bothRoads(ASK.chest, born("wardrobe", HOUSE_WARDROBE_LINE)))
      .toEqual(["not_carried", "not_carried"]);
  });

  it("⚠ a WARDROBE cast in an unread outfit is `coverage_unread` at the NECK", () => {
    /* The neck IS served, so an unread line reaches the coverage branch and
       fails closed — which is the demand for 7a-bis. */
    expect(bothRoads(ASK.neck, born("wardrobe", UNREAD)))
      .toEqual(["coverage_unread", "coverage_unread"]);
  });

  it("⚠ THE CORRECTION — a BASICS cast can reach NEITHER counted refusal today", () => {
    /*
      The arm this file exists for. Every surface, both spellings, both settings
      of the words road, and not one of them is a coverage refusal:

        neck        bare on both Basics forms — it RENDERS
        upper arm   bare on both — renders where the road is open, and asks for
                    a document where it is not, which is a fact about the ROAD
        upper chest `unknown`, and never asked: it is not served, so it falls to
                    the uncarried loop and answers `road_cannot_keep`
    */
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      const basics = born("basics", line);
      expect(bothRoads(ASK.neck, basics)).toEqual(["in_frame", "in_frame"]);
      expect(bothRoads(ASK.arm, basics)).toEqual(["in_frame", "needs_document"]);
      expect(bothRoads(ASK.chest, basics)).toEqual(["road_cannot_keep", "road_cannot_keep"]);
    }
  });

  it("⚠ and the reason is the SERVED SET, said where it can be checked", () => {
    /*
      THE MECHANISM, not a restatement of the outcome. The coverage branch is
      only entered for a placement the words road serves; `upperChest` is the
      one member of the vocabulary that is served at no setting, which is why a
      chest ask never asks about her outfit at all.

      Driven at the classifier rather than read off `WORDS_ROAD_PLACEMENTS`:
      a constant is what somebody would change, and this is what would then be
      TRUE. When it changes, this arm is the one that says so.
    */
    expect([...INK_PLACEMENTS]).toEqual(["neck", "upperArm", "upperChest"]);
    /* On an outfit that leaves everything showing — the Basics spec's own claim
       — the two served surfaces render and the third does not. */
    const bare = born("basics", basicsWardrobeLine("male"));
    expect(classifyInkPlacement(ASK.neck, "ink", true, bare).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.arm, "ink", true, bare).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.chest, "ink", true, bare).kind).toBe("road_cannot_keep");
  });

  it("⚠ CONTROL — the same reader DOES produce a Basics-path refusal, of another kind", () => {
    /*
      Without this the arms above could all be passing because the classifier
      answers the same thing for everything handed a Basics resolution. It does
      not: hand it a hidden place and the same call refuses, on the same cast,
      through a door that has nothing to do with her clothes.
    */
    const basics = born("basics", basicsWardrobeLine(null));
    expect(classifyInkPlacement("a swallow behind her ear", "ink", true, basics).kind)
      .toBe("needs_document");
  });
});
