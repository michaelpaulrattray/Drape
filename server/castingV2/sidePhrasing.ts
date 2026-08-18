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
