/**
 * CUT A SENTENCE WITHOUT CUTTING A WORD IN HALF — one declaration, every reader.
 *
 * `slice(0, n)` on a person's own sentence reads as a typo, not as a
 * truncation: there is no ellipsis and no control to fix it, so the customer
 * sees their own words handed back broken and the only way out is to rewrite
 * the brief.
 *
 * # Why it lives in its own file
 *
 * It was written once, privately, inside `heritagePromotion.ts`, where it fixed
 * exactly this defect at 80 characters. The projection that carries the same
 * string to the sheet then re-cut it at 60 with a bare slice, and the repair
 * did not travel — the founder's own brief came back as *"cast as a beauty
 * campaign casting, luminous skin, wide-set eyes, cro"* (#1122, found by the
 * #180 ghost audit).
 *
 * That is working law 4 in its quietest form: not a second list, a second
 * CUT of one string. A rule with two implementations has one that is wrong, so
 * this has one and the callers import it.
 *
 * **Behaviour is byte-identical to the original**, deliberately — the 80-cap
 * feeds the `CASTING CATEGORY` block of a paid prompt on the legacy road, and a
 * move is not the place to change what an engine is sent.
 */

/**
 * Cap without cutting a word in half.
 *
 * Falls back to the hard slice only when the first `max` characters contain no
 * space at all — a single unbroken 200-character token has no word boundary to
 * find, and returning nothing would be worse than returning it clipped.
 */
export function capAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trim();
}

/**
 * The same cut, for text that is about to be READ inside a composed sentence.
 *
 * The echo writes *"Everyone on this sheet is cast as "* + the value + the rest
 * of the sentence + a full stop, so a cut landing after a comma renders
 * `wide-set eyes,.` — a second visible defect underneath the first one. The
 * dangling separator goes with the half-word.
 *
 * **It only ever strips from a value it TRUNCATED.** A short category the user
 * really did end with a dash is theirs, crosses unchanged, and is not this
 * function's business; scoping the strip to the truncation keeps every value
 * that is not the defect byte-identical to what ships today.
 */
export function capForEcho(text: string, max: number): string {
  if (text.length <= max) return text;
  const capped = capAtWordBoundary(text, max);
  const stripped = capped.replace(/[\s,;:.!?—–-]+$/, "");
  return stripped.length > 0 ? stripped : capped;
}
