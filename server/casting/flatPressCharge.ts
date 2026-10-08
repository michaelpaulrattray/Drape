/**
 * THE FLAT-PRICE RULE, IN ONE PLACE — "credits come back only when nothing
 * could be delivered at all" (his word, 2026-10-08).
 *
 * **His sentence, verbatim, on #1968:**
 *
 * > *"Drop the 700 base + 200 per view split, since views are cut from two
 * > sheets and can't be refunded one by one. A failed check re-makes the whole
 * > sheet at our cost, and 1,000 covers the worst case. Credits only come back
 * > if the Sign can't be delivered at all."*
 *
 * ⚠ **IT IS ONE RULE FOR TWO ROADS, AND THAT IS WHY IT IS ITS OWN MODULE.**
 * The whole-package redo (#1903) ships on it first; the Sign (#1968) moves onto
 * it next. Two implementations of one founder ruling would be working law 4 on
 * a money path — the two roads could only ever disagree, and a customer would
 * get a refund on one press that the identical failure on the other did not.
 *
 * ⚠ **AND IT IS ASKED IN TWO PLACES, WHICH IS THE REAL REASON FOR A FUNCTION
 * RATHER THAN AN `if`.** The live service decides it from what its own renders
 * returned; the recovery sweep decides it hours later from the ROWS, with no
 * memory of the press at all. Those two readings have to agree exactly or a
 * crash pays a customer twice — so they call one function over one definition
 * of "delivered".
 *
 * ## What "delivered" means here, and it is deliberately generous
 *
 * ONE view is a delivered press. A customer who asked for all her views again
 * and received four of them has had the work done, and the fifth kept the
 * picture she already had — a redo never leaves a hole. The house paid for
 * both sheets whatever happened, which is what the flat price is for.
 *
 * The opposite reading — refund unless EVERY view arrived — was considered and
 * is not his: it would hand back a whole redo for one refused panel while the
 * customer keeps the other four new pictures.
 */

/**
 * What a flat-priced press owes back.
 *
 * `delivered` is how many of its units landed a picture. Nothing else about
 * the press matters here: not which views, not how many were asked for, not
 * what the judge said about the rest.
 */
export function flatPressRefundOwed(input: {
  chargedCredits: number;
  delivered: number;
}): number {
  if (input.chargedCredits <= 0) return 0;
  return input.delivered > 0 ? 0 : input.chargedCredits;
}

/**
 * The same rule, as the question the recovery sweep actually asks.
 *
 * The sweep holds a press row and a reader that says whether ANY of its units
 * landed; it never counts them. Written as its own export so a reader of the
 * sweep meets the rule by name rather than inferring it from a boolean.
 */
export function flatPressKeepsItsCharge(anythingDelivered: boolean): boolean {
  return anythingDelivered;
}
