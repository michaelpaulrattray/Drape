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
 *
 * ⚠ **AND NOW NEITHER VALUE IS REACHABLE, BECAUSE THE COLUMN HAS NO SOURCE
 * LEFT — #1577 slice 2 (the ghost audit's item B1), 2026-10-15.** The whole of
 * the reasoning above is about which PATH a refusal would record. The
 * resolution no longer carries a path at all: `rollPath` is not threaded into
 * `currentWardrobeLine`, `wardrobeNow.path` is gone, and the writer has
 * stopped passing `pathAtRefusal`. **So this file's subject is now the
 * ROUTING alone** — which asks reach which coverage verdict — and the enum
 * member it was written about can no longer be written by anything.
 *
 * **The column is kept** (a written table, and dropping one is a destructive
 * migration and his hand), and `casting_ink_form_demand` holds zero rows in
 * both worlds all time, so nothing is orphaned. **The arms below are kept and
 * re-pointed rather than deleted**, because what they actually measure —
 * which ask meets which wall on which outfit — is live product behaviour that
 * nothing else in the tree reads in one place.
 *
 * ⚠ **The fixture below says `edited` where it said `born`, and that is not
 * a behaviour change**: both sources always took the same door
 * (`coverageOfWardrobeLine` reads the line), while `brief` keeps the house
 * prior and still does. Every verdict asserted here is the one it was before.
 */
import { describe, expect, it } from "vitest";

import { INK_PLACEMENTS } from "../../shared/inkPlacementVocabulary";
import { classifyInkPlacement } from "./inkPlacement";
import { HOUSE_WARDROBE_LINE, basicsWardrobeLine } from "./wardrobeLine";
import type { WardrobeResolution } from "./wardrobeLine";

/**
 * A branch wearing a line the coverage owner READS — `edited` is the source
 * that does, since #1577 slice 2 retired `born` with the paths. The `path`
 * argument is kept in the SIGNATURE and ignored, so the arms below still say
 * out loud which path they are reasoning about even though the resolution can
 * no longer carry one. **That is deliberate**: the reasoning in this file's
 * header is entirely about Wardrobe versus Basics, and a fixture that silently
 * dropped the distinction would make those paragraphs unreadable.
 */
const born = (_path: "wardrobe" | "basics", line: string): WardrobeResolution =>
  ({ kind: "line", line, source: "edited" });

/** A picked outfit nobody has read the coverage of — `unknown` on every
 *  surface, which is every customer-named and every engine-picked line. */
const UNREAD = "a one-shoulder animal hide, bare legs, bare feet";

/** Both spellings the classifier matches, for each surface it can refuse on. */
const ASK = {
  chest: "a small swallow tattoo on her upper chest",
  neck: "a small swallow tattoo on her neck",
  arm: "a small swallow tattoo on her upper arm",
} as const;

/**
 * THE ROAD — one of them, since `CASTING_INK_WORDS_SCOPE` retired (#1577 slice
 * D3, his word 2026-10-15).
 *
 * ⚠ This was `bothRoads`, driving `[true, false]` on the reasoning that *"a
 * routing claim that is true at one and false at the other is not a routing
 * claim"*. That reasoning was right and is why the pairs below are worth
 * reading: where the two answers DIFFERED, the second was the narrow road, and
 * the flag stood at `all` on the service, so no account was ever on it. Each
 * retired expectation is named at its own call site rather than silently
 * dropped — an arm asserting an unreachable road is what slice 4b found 134 of.
 */
const theRoad = (text: string, wardrobe: WardrobeResolution) =>
  classifyInkPlacement(text, "ink", wardrobe).kind;

describe("the two counted refusals, and where they can actually come from", () => {
  it("⚠ a WARDROBE cast in the house line is `not_carried` — the counted covering", () => {
    /*
      §4 case (c): a Wardrobe brief naming no outfit falls back to the grey tee,
      whose upper chest is covered — measured, not assumed.

      ⚠ **ON THE OPEN ROAD ONLY, since 2026-08-23** — and since #1577 slice D3
      that is the only road there is. The second arm here asserted
      `needs_document` with the flag CLOSED, and it is removed with the flag
      rather than kept: `CASTING_INK_WORDS_SCOPE` stood at `all` on the
      service, so the narrow answer was one no account could receive.
    */
    expect(classifyInkPlacement(ASK.chest, "ink", born("wardrobe", HOUSE_WARDROBE_LINE)).kind)
      .toBe("not_carried");
  });

  it("⚠ a WARDROBE cast in an unread outfit is `coverage_unread` at the NECK", () => {
    /* The neck IS served, so an unread line reaches the coverage branch and
       fails closed — which is the demand for 7a-bis. */
    /* Both roads answered `coverage_unread` here, so retiring the narrow one
       takes nothing away from this claim. */
    expect(theRoad(ASK.neck, born("wardrobe", UNREAD))).toBe("coverage_unread");
  });

  it("⚠ a BRIEF-sourced line answers the HOUSE PRIOR — the ink gate does not move with #1222", () => {
    /*
      The SAME unread sentence that fails closed on a born line, from the
      brief's own source: the gate answers exactly what a stated-outfit cast
      got the day before the line existed (it was `unpathed` then). `unknown`
      here would flip every neck and upper-arm ask on every stated-outfit cast
      from pass to refusal — a capability regression riding a card about
      views. The declared approximation lives in `wardrobeCoversSurface`; it
      dies the day 7a-bis reads real lines.
    */
    const brief: WardrobeResolution = { kind: "line", line: UNREAD, source: "brief" };
    /* The neck passes, as it always has for these casts… */
    expect(classifyInkPlacement(ASK.neck, "ink", brief).kind).toBe("in_frame");
    /* …and the chest refuses as COVERED (the prior), never as unread. */
    expect(classifyInkPlacement(ASK.chest, "ink", brief).kind).toBe("not_carried");
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
      /* ⚠ All three were pairs until #1577 slice D3. The neck answered
         `in_frame` on both roads; the arm and the chest answered
         `needs_document` on the NARROW road, which no account was ever on, and
         those two expectations retire with the flag. The surviving answer is
         the one every account has always received. */
      expect(theRoad(ASK.neck, basics)).toBe("in_frame");
      expect(theRoad(ASK.arm, basics)).toBe("in_frame");
      expect(theRoad(ASK.chest, basics)).toBe("in_frame");
    }
  });

  it("⚠ and the reason is the SERVED SET, said where it can be checked", () => {
    /*
      THE MECHANISM, not a restatement of the outcome. The coverage branch is
      only entered for a placement the words road serves. `upperChest` was
      *"the one member of the vocabulary that is served at no setting"* when
      this was written; the Basics chest court put it on the road and #1577
      slice D3 retired the setting, so all three are served and a chest ask
      reaches the coverage branch like any other.

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
      expect(classifyInkPlacement(ask, "ink", bare).kind, ask).toBe("in_frame");
    }
    /* CONTROL — the same three asks on the house crew tee, where the chest is
       covered: the outfit is the only variable and it changes exactly one. */
    const tee = born("wardrobe", HOUSE_WARDROBE_LINE);
    expect(classifyInkPlacement(ASK.neck, "ink", tee).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.arm, "ink", tee).kind).toBe("in_frame");
    expect(classifyInkPlacement(ASK.chest, "ink", tee).kind).toBe("not_carried");
  });

  it("⚠ CONTROL — the same reader DOES produce a Basics-path refusal, of another kind", () => {
    /*
      Without this the arms above could all be passing because the classifier
      answers the same thing for everything handed a Basics resolution. It does
      not: hand it a hidden place and the same call refuses, on the same cast,
      through a door that has nothing to do with her clothes.
    */
    const basics = born("basics", basicsWardrobeLine(null));
    expect(classifyInkPlacement("a swallow behind her ear", "ink", basics).kind)
      .toBe("needs_document");
  });
});
