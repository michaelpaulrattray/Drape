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
 * **Today the answer is always yes, and that is on purpose** (fable-744 §3b).
 * The server's loader filters signed candidates out of the shortlist before it
 * is projected, so a signed face never reaches the tray and the flag is never
 * set — the ruling chose the loader as the product and deleted the projection's
 * field rather than widening the filter.
 *
 * The predicate stays anyway, because what it protects is the aim of a
 * 450-credit ceremony and the thing keeping a signed face out of range is a
 * `WHERE` clause one layer and one repository away. If that filter is ever
 * widened — deliberately or by accident — this is the line that stops a click
 * from arming a woman who has already been signed, instead of the defect
 * reappearing as a ring on the wrong face.
 */
export function canBeSigned(entry: SignableEntry): boolean {
  return entry.signed !== true;
}

/**
 * The tray's faces in the order the dock offers them: **newest keep first**,
 * signed faces removed if one ever arrives.
 *
 * The order is part of the rule rather than the caller's business — the last
 * thing you kept is almost always the one you mean, and a second caller
 * reversing it its own way is how the ring and the target come to disagree
 * again.
 */
export function signTargets<T extends object>(shortlist: readonly T[]): T[] {
  /*
    The constraint is `object`, not `SignableEntry`, and the widening is the
    point. Since fable-744 §3b the server's shortlist row does not DECLARE a
    `signed` field — so constraining on one made the compiler collapse every
    caller's row to the guard's own shape and lose its real columns. Requiring
    callers to re-declare a field the product does not send would be mirroring
    the rule back out into the surfaces this module exists to take it away from.
  */
  return [...shortlist].reverse().filter((entry) => canBeSigned(entry as SignableEntry));
}
