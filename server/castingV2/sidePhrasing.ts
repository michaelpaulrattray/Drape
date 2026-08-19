/**
 * WHERE A SIDE IS IN THE PICTURE — one sentence, one owner.
 *
 * Her right eye is on the LEFT of the photograph, and the engine appears to
 * paint by POSITION rather than by anatomy: a court of twelve renders put a
 * per-side eye edit on the named eye 6/6 when the named side was her LEFT (the
 * image's right) and 3/6 when it was her RIGHT (the image's left) — every miss
 * landing on the image's right half, whatever the recipe named
 * (`V4_SIDE_INFERENCE_COURT.md`). Saying the side BOTH ways — the anatomy the
 * customer means and the half of the picture it lives in — took a second court
 * from four misses in twelve to none, never once worse, at no cost per render.
 *
 * # It lives here because TWO lanes say it now
 *
 * It was private prose inside `recipeAssembler`, which was right while the
 * repaint recipe was the only thing that said it. The view-reference lane says
 * it too (fable-1006 §3), and a second copy of a measured sentence is the
 * parallel copy that drifts — the one that would drift being the difference
 * between her left and the picture's left, which is the exact confusion the
 * sentence exists to remove. So both callers come through this function, and
 * neither spells the phrase.
 *
 * **The flag governs the REPAINT lane only.** `CASTING_SIDE_PHRASING_SCOPE` is
 * about whether a paid refine's recipe carries the clause; the view lane carries
 * it unconditionally, because the view clause is house prose on a new road with
 * no installed behaviour to protect. Two lanes, one sentence, one gate each.
 */
import type { Instance } from "./referenceSlots";

/**
 * The parenthetical, with its leading space, for the side named.
 *
 * Said as the PAINTER sees it, because the painter is looking at the picture:
 * her left is the viewer's right.
 */
export function imageHalfClause(side: Instance): string {
  return side === "left"
    ? " (on the right of the picture as you look at it)"
    : " (on the left of the picture as you look at it)";
}

/* ------------------------------------------------------------------ *
 * THE OTHER DIRECTION — describing a side in a picture we were GIVEN  *
 * ------------------------------------------------------------------ */

/**
 * A half of a PICTURE, already picture-relative — never an anatomical side.
 *
 * Its own type rather than `Instance`, and that is the whole safety of this
 * half of the file: `Instance` is her body's side and `imageHalfClause` INVERTS
 * it, because her left is the viewer's right. A source description has nothing
 * to invert — the reader was asked which half of the frame it could see the
 * thing in, and the answer is already the answer. **Passing one where the other
 * belongs would flip a side silently, which is the exact confusion this module
 * exists to remove**, so the two cannot be passed to each other's function.
 */
export type PictureHalf = "left" | "right";

/**
 * WHERE IN THE PICTURE SHE POINTED — the source half of the same fact family
 * (ruled fable-1084 §2).
 *
 * Same family as `imageHalfClause` above: engines paint by position, anatomical
 * side words are unreliable, and one place knows how to say a side safely.
 * **Different direction**: that clause DIRECTS A PAINT on the target frame,
 * this one DESCRIBES a source we were handed. So it lives beside its sibling
 * and is spelled separately rather than reused.
 *
 * # Why it is four words and not eleven
 *
 * The clause above is long because it is a painting instruction with room to
 * be long. This one rides inside a customer-facing description with a hard
 * character budget (`hairColourFromReference`: the destination caps a free
 * value at 120, and a real four-block head already overruns it). Eleven words
 * per block would drop two blocks of her hair to say which side they were on,
 * which is paying for precision with content.
 *
 * # Why it is parenthesised
 *
 * The sentence it joins is comma-separated between blocks, so a comma-attached
 * side would be indistinguishable from the next block — *"copper at the fringe,
 * picture left, platinum at the fringe"* reads as three things. The bracket is
 * what makes two sided blocks in one sentence tell apart, which is the property
 * fable-1084 §2 required by construction rather than by prose.
 */
export function pictureSideClause(half: PictureHalf): string {
  return half === "left" ? " (picture left)" : " (picture right)";
}

/**
 * The words that tell a reader HOW to answer a side — composed here so the ask
 * and the spelling cannot drift apart (law 4).
 *
 * The reader is never asked for prose about a side. It is asked for a half, and
 * this module writes the words; a reader allowed to phrase it itself produced
 * *"down one side"* and *"down the other side"* on the same head, which is a
 * place a repaint cannot use and a contradiction a person can see.
 */
export function pictureSideAskLines(): string[] {
  return [
    'side: "left" or "right" if this block is clearly on one half of the PICTURE',
    "  as you look at it — not her left or right, the picture's. Use null if it is",
    "  not a side: all over, at the roots, at the ends, at the fringe across both.",
  ];
}
