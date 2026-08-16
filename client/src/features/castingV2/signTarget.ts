/**
 * WHO THE SIGN DOCK CAN BE AIMED AT — one rule, in one place (fable-729 §5).
 *
 * Sign is the 450-credit ceremony, and the tray is where it is aimed: a single
 * click on a kept face selects her, an accent ring says who, and the button
 * names no number because the ring already does.
 *
 * The rule was written twice. The sheet built its target list with
 * `filter((entry) => !entry.signed)` and the tray drew every shortlist entry as
 * a radio labelled *"Sign 03 from ROLL 02"* — so a signed face was clickable,
 * clicking her wrote a selection the target list could not honour, and the ring
 * stayed on whichever woman the fallback had picked. The founder would have
 * clicked one face and armed a different one, on the most expensive control in
 * the product.
 *
 * That is the mirror law (working law 4) on a money surface: two lists of the
 * same fact, drifting the moment either is edited. There is one predicate now,
 * and both surfaces ask it.
 */

/** The one fact this rule needs. Structural, so the tray's entry and the
 *  sheet's shortlist row both satisfy it without a shared import of either. */
export type SignableEntry = { signed?: boolean };

/**
 * Can this kept face be signed?
 *
 * A signed face stays in the tray — she is part of this sheet's story, and the
 * server keeps her there deliberately — but she can never be a Sign target,
 * because the ceremony has already happened to her.
 */
export function canBeSigned(entry: SignableEntry): boolean {
  return entry.signed !== true;
}

/**
 * The tray's faces in the order the dock offers them: **newest keep first**,
 * signed faces removed.
 *
 * The order is part of the rule rather than the caller's business — the last
 * thing you kept is almost always the one you mean, and a second caller
 * reversing it its own way is how the ring and the target come to disagree
 * again.
 */
export function signTargets<T extends SignableEntry>(shortlist: readonly T[]): T[] {
  return [...shortlist].reverse().filter(canBeSigned);
}
