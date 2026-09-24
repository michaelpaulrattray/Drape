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

/**
 * The same cut, for a sentence that is HERS with a tail that is OURS.
 *
 * # The defect it closes, and why cutting the whole thing is not it (#1126)
 *
 * A re-ask resolves into her sentence plus a clarifier we composed — *"… (her
 * left)"*, *"… — the hair"*, *"… (exactly as written)"*. The clarifier is the
 * only thing telling two versions of one ask apart on the rail, so it is the
 * WORST part of the sentence to lose, and a cut that reads from the left loses
 * exactly it: {@link capForEcho} over the whole composition returns her words
 * and an unclosed bracket.
 *
 * So the room comes out of HER part and the tail crosses whole. She loses the
 * tail of a sentence she wrote and can still see in the box; she keeps the
 * words that say which version this is.
 *
 * **When the tail alone cannot fit** there is nothing left to protect and this
 * falls back to the plain cut — a field narrower than our own clause is a
 * defect somewhere else, and a third behaviour invented here would hide it.
 */
export function capForEchoWithTail(head: string, tail: string, max: number): string {
  const composed = `${head}${tail}`;
  if (composed.length <= max) return composed;
  const room = max - tail.length;
  if (room <= 0) return capForEcho(composed, max);
  return `${capForEcho(head, room)}${tail}`;
}
