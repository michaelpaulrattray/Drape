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
 * step it skipped was one door further on. **As of the morning of 2026-08-23**,
 * `upperChest` was not a placement the words road served, so a chest ask never
 * reached the coverage branch at all: it fell through to the uncarried loop,
 * where an outfit that did not cover it produced `road_cannot_keep` — *this road
 * cannot crop a result there* — a fact about US, identical on every path and
 * every outfit, and correctly not a wardrobe demand. Meanwhile a Basics line
 * leaves `neck` and `upperArm` bare, so those RENDER. **So no Basics cast could
 * produce a coverage refusal**, and `pathAtRefusal: "basics"` was unreachable.
 *
 * Measured by driving `classifyInkPlacement` over both paths and both spellings
 * (opus-1118), not read off the tables.
 *
 * # ⚠ AND THE FIX I PREDICTED WAS WRONG, WITHIN HOURS, IN THE SAME SITTING
 *
 * This file went on to say the narrower sentence that should have been written:
 * ***`basics` becomes reachable the day `upperChest` joins the served set*** —
 * the court in fable-1296 §3. **That day was the same day, the court ran, the
 * chest joined the road — and `basics` is still unreachable.**
 *
 * The prediction assumed the coverage branch would answer `unknown` for a Basics
 * line. By the time the chest reached that branch, the OTHER half of the same
 * afternoon had flipped `BASICS_COVERAGE.upperChest` to `bare` on twelve of
 * twelve frames, so the ask does not refuse at all — it renders.
 *
 * **Both of my sentences about this enum member were about a routing that moved
 * under them**, and the lesson is not about tattoos: *a reachability claim is a
 * claim about a PATH THROUGH CODE, and a path through code is the least stable
 * thing you can hang a prediction on.* The conclusion survived twice by
 * accident, not by the reasoning.
 *
 * What is true now, and stated as a property rather than as a route: `basics`
 * needs a Basics-path cast wearing a line the coverage owner cannot answer for.
 * Both `basicsWardrobeLine` forms are known, so that means an EDITED line on a
 * Basics branch — and §7.2 refuses a wardrobe edit on that path. **Unreachable
 * by construction rather than by routing**, which is the first version of this
 * sentence that does not depend on which loop a string falls into.
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
 *
 * ✅ **`upperChest` JOINED THE SERVED SET THE SAME DAY THIS FILE WAS WRITTEN,
 * AND THE INSTRUMENT DID EXACTLY WHAT ITS OWN PARAGRAPH SAID IT WOULD.** Three
 * arms went red on the widening; they are rewritten below rather than relaxed,
 * and the paragraph above is left standing because it is what earned the
 * rewrite.
 *
 * ⚠ **THE CONCLUSION DID NOT CHANGE AND THE MECHANISM DID.** `basics` is STILL
 * unreachable as a `pathAtRefusal`, for a new reason: the chest ask no longer
 * falls to the uncarried loop, it reaches the coverage branch and comes back
 * `bare`, so it RENDERS. A Basics cast reaches no coverage refusal because
 * nothing about a Basics outfit refuses — which is a better sentence than the
 * one this file was written to say, and it is still an unreachable enum member.
 *
 * **What would make `basics` reachable is now a different thing**: a Basics-path
 * cast wearing a line the coverage owner cannot answer for. Both
 * `basicsWardrobeLine` forms are known, so it needs an EDITED line on a Basics
 * branch — and §7.2 refuses a wardrobe edit on that path. So the value stays
 * unreachable by construction rather than by a routing accident, which is a
 * stronger statement than the one it replaces.
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
    /*
      §4 case (c): a Wardrobe brief naming no outfit falls back to the grey tee,
      whose upper chest is covered — measured, not assumed.

      ⚠ **ON THE OPEN ROAD ONLY, since 2026-08-23.** With the flag closed the
      chest is not served and the ask meets the derived document message instead;
      the counted covering is a fact about accounts whose road reaches the chest,
      and `CASTING_INK_WORDS_SCOPE` is `all`, so that is all of them.
    */
    expect(classifyInkPlacement(ASK.chest, "ink", true, born("wardrobe", HOUSE_WARDROBE_LINE)).kind)
      .toBe("not_carried");
    expect(classifyInkPlacement(ASK.chest, "ink", false, born("wardrobe", HOUSE_WARDROBE_LINE)).kind)
      .toBe("needs_document");
  });

  it("⚠ a WARDROBE cast in an unread outfit is `coverage_unread` at the NECK", () => {
    /* The neck IS served, so an unread line reaches the coverage branch and
       fails closed — which is the demand for 7a-bis. */
    expect(bothRoads(ASK.neck, born("wardrobe", UNREAD)))
      .toEqual(["coverage_unread", "coverage_unread"]);
  });

  it("⚠ THE CORRECTION — a BASICS cast can reach NEITHER counted refusal, and now for a better reason", () => {
    /*
      The arm this file exists for, rewritten on the day the routing moved. Every
      surface, both spellings, both settings of the words road, and not one of
      them is a coverage refusal:

        neck        bare on both Basics forms — it RENDERS
        upper arm   bare on both — renders where the road is open, and asks for
                    a document where it is not, which is a fact about the ROAD
        upper chest ⚠ RENDERS on the open road since 2026-08-23. It used to fall
                    to the uncarried loop and answer `road_cannot_keep`; the
                    Basics chest court put it on the road, so it now reaches the
                    coverage branch and comes back `bare`

      **The conclusion is unchanged and the sentence behind it is stronger**: a
      Basics cast reaches no coverage refusal because nothing about a Basics
      outfit refuses, rather than because the road could not carry a result.
    */
    for (const line of [basicsWardrobeLine("male"), basicsWardrobeLine(null)]) {
      const basics = born("basics", line);
      expect(bothRoads(ASK.neck, basics)).toEqual(["in_frame", "in_frame"]);
      expect(bothRoads(ASK.arm, basics)).toEqual(["in_frame", "needs_document"]);
      expect(bothRoads(ASK.chest, basics)).toEqual(["in_frame", "needs_document"]);
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
    /*
      ⚠ ON AN OUTFIT THAT LEAVES EVERYTHING SHOWING, ALL THREE NOW RENDER — and
      that is the whole of what the Basics chest court bought. The third used to
      be the odd one out here, refused by the road rather than by the garment.
    */
    const bare = born("basics", basicsWardrobeLine("male"));
    for (const ask of [ASK.neck, ASK.arm, ASK.chest]) {
      expect(classifyInkPlacement(ask, "ink", true, bare).kind, ask).toBe("in_frame");
    }
    /* CONTROL — the same three asks on the house crew tee, where the chest is
       covered: the outfit is the only variable and it changes exactly one. */
    const tee = born("wardrobe", HOUSE_WARDROBE_LINE);
    expect(classifyInkPlacement(ASK.neck, "ink", true, tee).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.arm, "ink", true, tee).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.chest, "ink", true, tee).kind).toBe("not_carried");
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
