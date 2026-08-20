/**
 * WHICH OF HER DESIGNS THIS ASK IS ABOUT — the one owner of that decision.
 *
 * A customer's sentence names a PLACE ("put it on her neck"), never a design.
 * A Cast may hold up to eight (`INK_DESIGNS_PER_CANDIDATE`). So something has
 * to get from a place to a row, and the whole question is what it does when the
 * place does not name exactly one.
 *
 * # THE ANSWER IS NEVER A DEFAULT (ruled fable-1145 §4)
 *
 * Three roads were weighed and two were refused:
 *
 *   the most recent    a quiet default choosing on her behalf — the
 *                      unowned-axis class with a timestamp for an alibi, and
 *                      the same shape as the earring fallback that was killed
 *   refuse, silently   the honest answer with the honesty left out
 *   REFUSE, NAMED      ← this. She is told the placement, the COUNT, and the
 *                      one road that exists today
 *
 * The refusal is not a wall being polite about itself: the per-design delete
 * shipped this same week, so *"remove the one you don't mean"* is a real move
 * she can make right now. And it promises nothing about a picker, because the
 * ink studio's room does not exist and a sentence hinting at one would be the
 * dead-end-wearing-a-tap-target D-180 forbids.
 *
 * **When the room arrives, the picker supersedes this refusal** — the choice
 * stays on the board rather than being spent now by a default nobody would have
 * chosen deliberately.
 *
 * # WHY IT IS A PURE FUNCTION OVER ROWS ALREADY READ
 *
 * It takes the Cast's designs rather than fetching them, for the reason working
 * law 3 gives: every refusal here is one a suite would otherwise "prove" by
 * never triggering it. Driven directly, a planted two-design placement is one
 * line instead of a database.
 *
 * The read itself stays where it belongs — `listInkDesigns`, owner-scoped on
 * BOTH sides of its join — so nothing here can be handed a row belonging to
 * somebody else by a caller that forgot.
 */
import { inkDesignWasExamined } from "../../shared/inkCutRoute";
import { isInkPlacement, inkPlacementBareNoun } from "../../shared/inkPlacementVocabulary";
import type { InkSide } from "../../shared/inkReleasedPlacements";
import type { StoredInkDesign } from "../db/castingV2InkDesigns";
import type { InkAskPlacement } from "./referenceSlots";

/**
 * WHERE THE ASK PUTS IT, as the take read it.
 *
 * `side: null` is *she did not say*, which is a real state and never an
 * invented arm: the side is this road's measured failure (300 credits refunded
 * twice for a design on the wrong anatomical side, DECISION_LOG R7-7G), so an
 * unstated side narrows nothing and lets the count below do the talking.
 */
export type InkAskAddress = Omit<InkAskPlacement, "side"> & {
  /**
   * THE ROW'S SIDE VOCABULARY, which is WIDER than the slot grammar's — and
   * saying so by derivation rather than by re-listing the fields.
   *
   * `InkSide` has three members and `Instance` has two: `centre` is the
   * vocabulary's answer for a surface there is ONE of, and the slot grammar
   * says that same thing by having no instance at all. So this is not a second
   * copy of `InkAskPlacement` — it is that type with one field widened, and
   * {@link slotPlacementOf} is the narrowing back.
   *
   * Written as an `Omit` because a re-listed shape is a copy that drifts by
   * losing a field nothing can see, and the Atlas says so mechanically. The
   * `placement` half is inherited here, so the day it gains a member or a
   * constraint this type follows without anybody remembering to.
   */
  side: InkSide | null;
};

export type InkDesignForAsk =
  /** Exactly one design answers this ask, and it has been looked at. */
  | { kind: "ride"; design: StoredInkDesign }
  /** She has no design at the place she named. */
  | { kind: "none"; say: string }
  /** More than one, and choosing between them is hers to do — fable-1145 §4. */
  | { kind: "ambiguous"; count: number; say: string }
  /** One design, stored before anybody looked at what is in its picture. */
  | { kind: "unexamined"; say: string };

/**
 * How the place is spoken back to her — the vocabulary's own noun for a surface
 * it has measured, and her exact phrase for one it has not.
 *
 * Through `inkPlacementBareNoun` rather than a second strip of the possessive:
 * the take's own spoken-back place comes from that owner too, so a customer who
 * meets both sentences hears one product rather than two.
 */
function placeIn(address: InkAskAddress): string {
  const surface = isInkPlacement(address.placement)
    ? inkPlacementBareNoun(address.placement)
    : address.placement;
  return address.side === "left" || address.side === "right"
    ? `her ${address.side} ${surface}`
    : `her ${surface}`;
}

/**
 * The designs this address could mean.
 *
 * A stated side NARROWS; an unstated one does not. That asymmetry is the whole
 * of the side rule here: narrowing on a side she never said would be the road
 * choosing an arm for her, and widening on one she did say would be ignoring
 * the only word that stops a design landing on the wrong one.
 *
 * `centre` is the vocabulary's answer for a surface there is one of, so it is
 * never something a sentence states and never something this filter matches
 * against a stated side — a `centre` row at the named placement is simply a row
 * at that placement, which it is.
 */
function matching(
  designs: readonly StoredInkDesign[],
  address: InkAskAddress,
): readonly StoredInkDesign[] {
  const here = designs.filter((design) => design.placement === address.placement);
  if (address.side === null) return here;
  return here.filter((design) => design.side === address.side);
}

/**
 * WHICH DESIGN RIDES, or the sentence she reads instead.
 *
 * Every non-`ride` answer carries its own finished sentence rather than a code
 * for the caller to phrase. That is deliberate: these sentences differ in what
 * they hand her to DO, and a caller composing them from a reason would be the
 * second author of a distinction this function exists to make.
 */
export function inkDesignForAsk(
  designs: readonly StoredInkDesign[],
  address: InkAskAddress,
): InkDesignForAsk {
  const place = placeIn(address);
  const here = matching(designs, address);

  if (here.length === 0) {
    return {
      kind: "none",
      say: `I don't have a design for ${place} yet. Send me the tattoo you want and `
        + "I'll put it on her. Nothing was charged.",
    };
  }

  if (here.length > 1) {
    /*
      NAMED, WITH THE ROAD THAT EXISTS TODAY (fable-1145 §4's three conditions).

      The count is said because "you have more than one" and "you have four" ask
      for different amounts of thinking from her, and she cannot see the list.
      The delete is said because it shipped this week and is the move that
      actually unblocks her. Nothing is said about a picker.
    */
    return {
      kind: "ambiguous",
      count: here.length,
      say: `I've got ${here.length} designs for ${place}, so I don't know which one you mean. `
        + "Remove the ones you don't want, or ask for a place where there's just one. "
        + "Nothing was charged.",
    };
  }

  const design = here[0]!;
  if (!inkDesignWasExamined(design.cutRoute)) {
    /*
      NOBODY LOOKED AT WHAT IS IN THIS PICTURE.

      `cutRoute: null` is not "unset" — it is the recorded fact that
      `CASTING_INK_CUT_SCOPE` was off when those bytes were stored, so what sits
      at `storageKey` is the picture she uploaded rather than the design cut out
      of it. On this road unexamined means POSSIBLY A PHOTOGRAPH OF A PERSON,
      which is the exposure the cutter exists to close, and it is the exact set
      of rows the flag's off-period created.

      Refused FREE here rather than only at the assembler (ruled fable-1146 §3):
      a charge raised and reversed for a fact known before the claim is the
      wrong shape. The assembler keeps its own arm as the backstop — it is the
      last door before an engine sees bytes, and a guard whose only test runs
      through a door that usually behaves is not a tested guard.

      Her sentence says nothing about flags or cutters. It says the one true
      thing she can act on: this one needs sending again.
    */
    return {
      kind: "unexamined",
      say: `The design I have for ${place} was saved before I could check what was in it, `
        + "so I can't use it yet. Send it again and I'll take it from there. "
        + "Nothing was charged.",
    };
  }

  return { kind: "ride", design };
}

/**
 * THE SAME ADDRESS, IN THE SLOT GRAMMAR'S WORDS — and the two vocabularies do
 * not agree, which is why this is a function rather than a cast.
 *
 * A design ROW's side is `InkSide`: `left`, `right`, or **`centre`**. A library
 * SLOT's instance is `Instance`: `left`, `right`, or nothing at all. `centre`
 * is the vocabulary's answer for a surface there is ONE of (`neck`,
 * `upperChest`), and the slot grammar says that same thing by having no
 * instance suffix — `ink:neck`, never `ink:neck@centre`, which
 * `inkPlacementOfSlot` refuses outright because the suffix list is closed.
 *
 * So `centre` maps to `null`, and it is a TRANSLATION rather than a loss: both
 * spellings mean *this surface is one place*. Written here, once, because the
 * alternative is a call site coercing it — and a call site that got it backwards
 * would ask for `ink:neck@centre`, which resolves to nothing, and the design
 * would be dropped one door later by a slot the catalogue never heard of.
 *
 * The two real sides pass through untouched. That is the half worth protecting:
 * this road's measured failure is a design on the wrong arm, so a mapping that
 * ever moved `left` would be the R7-7G refund with a new author.
 */
export function slotPlacementOf(address: InkAskAddress): InkAskPlacement {
  return {
    placement: address.placement,
    side: address.side === "centre" ? null : address.side,
  };
}
