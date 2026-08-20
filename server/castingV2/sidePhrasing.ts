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
 * WHICH HALF OF THE PICTURE ONE OF HER SIDES IS IN — **THE ONE OWNER OF THE
 * FLIP** (approved fable-1172 §3).
 *
 * Her left is the viewer's right. That inversion used to be spelled inside the
 * clause below's own return, which was right while prose was the only thing
 * anybody wanted from it. A second consumer wants the HALF ITSELF — the region
 * cut scopes a source picture to a half of its own frame — and a second copy of
 * *her left is the picture's right* is exactly the parallel copy this module
 * exists to prevent (law 4). So the flip happens once, here, and the clause
 * below reads it.
 *
 * ⚠ **IT ASSUMES A SUBJECT FACING THE CAMERA, and that assumption is the
 * caller's to own rather than this function's** (opus-869 §1). A photograph
 * taken from behind swaps the halves back, and nothing in an arbitrary picture
 * says which way its subject is turned. On the paint side the assumption is
 * safe — the frame being painted is our own front-facing master. On the SOURCE
 * side it is a guess, and the road that guesses is required to SHOW the cut
 * before anything is charged (ruled fable-1172 §1), which is what converts
 * *never guess a side* into *guess, show the guess, charge only on her yes*.
 */
export function imageHalfOf(side: Instance): PictureHalf {
  return side === "left" ? "right" : "left";
}

/**
 * The words for a half of a picture, without brackets and without a leading
 * space — so a caller building a SENTENCE about a source picture and a caller
 * building a painting CLAUSE both say it the same way.
 *
 * Separate from `pictureSideClause` below on purpose: that one is four words
 * because it rides inside a hard character budget, and this one is the full
 * phrase for a place that has room. Same fact, two lengths, one file — never
 * two spellings of the flip, which is the only part that can be wrong.
 */
export function pictureHalfPhrase(half: PictureHalf): string {
  return `on the ${half} of the picture as you look at it`;
}

/**
 * The parenthetical, with its leading space, for the side named.
 *
 * Said as the PAINTER sees it, because the painter is looking at the picture:
 * her left is the viewer's right. Both halves of that sentence are now DERIVED
 * — the flip from `imageHalfOf`, the words from `pictureHalfPhrase` — so this
 * function is a shape rather than a fact.
 */
export function imageHalfClause(side: Instance): string {
  return ` (${pictureHalfPhrase(imageHalfOf(side))})`;
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
