/**
 * WHICH VERSION SIGN IS ABOUT TO MAKE PERMANENT — the sentence, and when there
 * is no sentence to say (#1478, his ruling **A**, 2026-09-29).
 *
 * His report: *"i refined him edited his nose but only his original image
 * signed"*. Read at the production rows, the product did nothing random — he
 * had stepped back to the original to compare, seventeen seconds before he
 * pressed Sign, so the original really was the picture on his screen and Sign
 * signed the picture on his screen. What it did do was stay silent: nothing in
 * the Sign box mentioned that the edit he had just paid for was not the thing
 * about to be made permanent.
 *
 * Put to him as three options; his word, verbatim and entire, quoting the
 * first one back: *"A: Sign shows you which version it's about to sign, with
 * the picture, before you spend. Their recommendation, and mine."* — *"go with
 * this"*. Not B (Sign silently taking the newest edit) and not C (leave it).
 *
 * # THE PICTURE WAS ALREADY RIGHT. ONLY THE WORD WAS MISSING.
 *
 * `projectShortlist` sends the tray `faceImageKey`, which is the selected
 * refinement's picture falling back to the original — the same fact
 * `getSignableCandidate` resolves the Sign from. So the face in the box has
 * always been the face about to be signed, and nothing here moves it. What is
 * added is the product saying out loud which one that is.
 *
 * # WHY IT SAYS NOTHING WHEN SHE HAS NEVER BEEN EDITED
 *
 * ⚠ **This is the clause to read before "simplifying" it to always render.**
 *
 * *"This signs your original"* on a face that has only ever had one picture
 * names a distinction that does not exist for her, and invites the question it
 * was meant to answer — *original as opposed to what?* That is the
 * disappearing-technology law's clause 6 exactly: machinery showing through,
 * fixed by removing the thing rather than explaining it better.
 *
 * It is not a hypothetical population. Read at the production rows the day the
 * card was refused: **nine candidates have been signed, all time, and not one
 * had a variant of any status** — so a sentence rendered unconditionally would
 * have spoken about versions on every Sign this product has ever performed, and
 * been about a real choice on none of them.
 *
 * # AND WHY THE ORIGINAL CASE IS THE ONE THAT CARRIES THE LONGER SENTENCE
 *
 * *"This signs your edit"* confirms what someone already believes. *"This signs
 * your original"* contradicts it, and it is the only case that has ever cost
 * anybody anything — so it names the thing being passed over rather than
 * leaving him to infer it from a noun. It states a fact; it does not offer a
 * control, ask a question, or put a decision in front of him.
 */

/** Which of her pictures the 450 credits are about to be spent on. */
export type SignVersion = "original" | "edit";

/**
 * The version to name, or `null` when there is nothing to name.
 *
 * ⚠ **The pointer handed in is the SERVER's, and that is load-bearing.** Every
 * other surface on the sheet resolves "which version is she on" through
 * `selectedVariantFor`, which prefers a click whose write is still in flight —
 * and this one must not, because the Sign box is not one of those surfaces. Its
 * picture comes off the kept strip, which the override never reaches, and the
 * Sign itself resolves from `selectedVariantId` on the server. Reading the
 * click-aware answer here would produce a sentence that contradicts the
 * photograph next to it and the money underneath it. The caller's own comment
 * carries the window this matters in.
 */
export function signVersionFor(input: {
  /**
   * How many ready refinements this face has.
   *
   * ZERO is the quiet case above. It is a count rather than a boolean because
   * the caller reads it off the refinement list it already holds, and a
   * boolean would be that list asserted somewhere else.
   */
  refinementCount: number;
  /** Which version the SERVER has recorded as hers — `null` is the original,
   *  which is a real selection and not an absence. */
  selectedVariantId: string | null;
}): SignVersion | null {
  const { refinementCount, selectedVariantId } = input;
  if (refinementCount <= 0) return null;
  return selectedVariantId === null ? "original" : "edit";
}

/**
 * What the box says, in his words.
 *
 * The copy lives beside the rule rather than in the component, so the arms that
 * prove the rule can read the sentence a customer is actually shown — a test
 * asserting `"edit"` and a modal rendering the wrong string would both be green.
 */
export const SIGN_VERSION_COPY: Record<SignVersion, string> = {
  edit: "This signs your edit.",
  original: "This signs your original, not your edit.",
};
