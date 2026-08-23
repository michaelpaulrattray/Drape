/**
 * WHICH INK PLACEMENTS HAVE EARNED THEIR RELEASE — the second of two tables,
 * and the second table exists because of a 300-credit receipt.
 *
 * # Measured is not earned
 *
 * `inkPlacementVocabulary.ts` answers *does the photograph contain this
 * surface* — a fact about the frame, established by opening sixteen masters and
 * then asking a reader with a covered control beside it. This file answers a
 * different question: *has ink actually HELD there in a paid drive*. A surface
 * can plainly be in the picture and still be somewhere this product cannot put
 * a design without the design landing mirrored, misplaced or on the other arm.
 *
 * The legacy ink road learned that with money and wrote the rule in its own
 * docblock (`server/casting/evidence/inkReleasePolicy.ts`, 2026-07-29):
 *
 * > *"A tuple is not inferred from a neighbouring body region or opposite side:
 * > every zone/surface/laterality combination earns release on its own
 * > evidence."*
 *
 * It released **8 tuples of 288**. What it refused is the instructive half: a
 * delivered candidate that *"visibly mirrored the left-shoulder triangle"*, and
 * a placement audit that rejected both Walk attempts at **90% confidence for
 * wrong anatomical side** while identity and framing passed — 300 credits
 * refunded, twice (DECISION_LOG, R7-7G).
 *
 * **V2 measured the same failure from scratch three weeks later** on a
 * different engine through a different road: her right eye 3/6 against her left
 * 6/6, and "her left ear" clearing the image's RIGHT half 6 times of 6 even
 * mirrored. Two roads, two engines, one failure — laterality is this road's
 * proven killer, and it is why a side is part of the key rather than a
 * modifier on it.
 *
 * # THE TABLE IS EMPTY, AND EMPTY IS THE CORRECT STATE
 *
 * Nothing has been driven on this road yet, so nothing has earned anything. The
 * chunk this file lands in ships dark; an empty released table is what "dark"
 * means expressed as data rather than as a flag.
 *
 * That makes the table unable to prove its own rule — `false` for every input
 * is what a table with no entries says and also what a broken reader says. So
 * the rule lives in {@link releasedAgainst}, which takes the set as an
 * argument, and its test drives it against an injected set where release is
 * reachable and the refusals beside it therefore mean something.
 */
import {
  INK_PLACEMENTS,
  inkPlacementEntry,
  type InkPlacement,
} from "./inkPlacementVocabulary";

/**
 * Which side of her the design sits on.
 *
 * `centre` rather than "none" because it is a place, not an absence — a neck
 * piece sits centrally, and the word the recipe writes should name where it
 * goes. The legacy road used the same three and it is the right vocabulary.
 */
export const INK_SIDES = ["left", "right", "centre"] as const;
export type InkSide = (typeof INK_SIDES)[number];

export interface InkTuple {
  readonly placement: InkPlacement;
  readonly side: InkSide;
}

/**
 * The sides a placement has, DERIVED from the vocabulary's own `sides` field.
 *
 * Law 4: a second list of which placements are paired would drift from the one
 * the vocabulary already states. A placement added there arrives here with its
 * sides already decided.
 */
export function sidesForInkPlacement(placement: InkPlacement): readonly InkSide[] {
  // deliberate-vocabulary-copy: the two sided values are the perSide HALF of
  // INK_SIDES, written out because this function IS the narrowing — the
  // unpaired case is the other branch. (Real negative control for the
  // near-miss reading in scripts/sweep-handwritten-vocabularies.mts; delete
  // this marker and that arm reddens.)
  return inkPlacementEntry(placement).sides === "perSide"
    ? (["left", "right"] as const)
    : (["centre"] as const);
}

/** Every tuple the vocabulary can currently express — four, today. */
export function everyInkTuple(): readonly InkTuple[] {
  return INK_PLACEMENTS.flatMap((placement) =>
    sidesForInkPlacement(placement).map((side) => ({ placement, side })),
  );
}

export function inkTupleKey(tuple: InkTuple): string {
  return `${tuple.placement}:${tuple.side}`;
}

/**
 * ⚠ NO DOOR CONSULTS THIS. Read the note below before citing it as a gate.
 *
 * # THE GATE DOES NOT EXIST (found at the wire 2026-08-19, ruled fable-1064 §3)
 *
 * This file's rule is real and its emptiness is correct. What was NOT true is
 * the sentence several docblocks carried — that release gates the render, at a
 * before-dispatch door. **A repo-wide sweep finds no caller of
 * `isInkTupleReleased` or `INK_PLACEMENT_NOT_RELEASED` outside this module's own
 * test.** There is no such door and there never was one.
 *
 * What was actually keeping ink off customers' photographs was the absence of a
 * PLATE: the studio flag was off, so nothing was ever drawn to ride. Turning it
 * on for one account removed that, and a neck plate rode into a signed Cast's
 * views in a wire test written to check exactly this.
 *
 * **What holds today** is `MANNEQUIN_ROAD_DEFERRED` (`shared/inkMannequinDeferral.ts`)
 * — the founder's own deferral of the mannequin road, gated at the mint and at
 * the view-reference lane. That is a named mechanism rather than luck, and it is
 * the only one.
 *
 * **This table is therefore UNBUILT MACHINERY, not a control**, and no document
 * may describe it as governing anything until a door consults it. The resumption
 * prerequisite in `inkMannequinDeferral.ts` is where that gets fixed: the road
 * does not resume until the release door exists, is wired at the dispatch it
 * claims to govern, and has been driven RED.
 */

/**
 * The released set. **Empty**, deliberately, until a drive earns an entry.
 *
 * An entry here is a claim that ink was rendered at that exact placement AND
 * that exact side and held — read at the frames, with the founder's eye on it
 * (law 9). It is never written by inference from the tuple next to it.
 */
export const RELEASED_INK_TUPLES: ReadonlySet<string> = new Set<string>();

/**
 * The rule, with its set as an argument so it can be proven where release is
 * reachable. See the header: an empty table cannot fail its own test.
 */
export function releasedAgainst(tuple: InkTuple, released: ReadonlySet<string>): boolean {
  return released.has(inkTupleKey(tuple));
}

export function isInkTupleReleased(tuple: InkTuple): boolean {
  return releasedAgainst(tuple, RELEASED_INK_TUPLES);
}

/**
 * What a customer is told when the surface is in the picture and the product
 * has not proven it can put a design there yet.
 *
 * It names the state rather than blaming the ask, and it promises the money —
 * this refusal happens before anything is generated, so there is nothing to
 * argue about afterwards.
 */
export const INK_PLACEMENT_NOT_RELEASED =
  "We can see that part of her, but the studio hasn't proven it can place a "
  + "design there yet — it opens as soon as it has. Nothing was charged.";
