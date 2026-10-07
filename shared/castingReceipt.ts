/**
 * WHAT A SHEET COSTS A FACE AT A TIME, AND THE ONE SENTENCE THAT SAYS SO
 * (#1908, his word 2026-10-07: *"1,2,3 seeing as these are small make cards
 * for these"*, on Yuna's Founder Desk item *"Cost beside Cast it in plain
 * words"*).
 *
 * The receipt beside **Cast it** states what a whole sheet costs. That is the
 * number that is charged, so it is the number the line must lead on — but it
 * is not the number that answers *"is that a lot?"*. A sheet is eight faces,
 * each independently billed and independently refunded, and the per-face
 * figure is the one a customer can reason with.
 *
 * # It is DERIVED, and that is the whole reason this module exists
 *
 * Yuna's draft of the sentence read *"~240 … 30 credits a face"*. Both numbers
 * were true of the price table as it stood before 2026-10-01 and neither was
 * true on the day she wrote them — a Roll is 1,600 ledger / 320 display now,
 * so a face is 40. **A hand-typed per-face figure is the same defect as a
 * hand-typed price, one division further away from the charge**, and it is
 * harder to notice because nothing on screen contradicts it.
 *
 * So the figure is computed from the two numbers the server already sends
 * (`rollPriceCredits` and `candidatesPerRoll`), and nothing here declares a
 * price. ⚠ **It takes the sheet price as an ARGUMENT rather than reading a
 * constant**, which is what makes it correct for a Follow as well as a Roll:
 * the two are equal today (#1753, his *"one price is better and we earn more
 * for rolls simple"*) and have moved twice in two days, so a helper that knew
 * which price it was quoting would be the thing to fix the next time they
 * diverge. `server/castingV2/receiptPerFace.test.ts` drives it with the real
 * `CASTING_V2_ROLL_PRICE_CREDITS` and `CASTING_V2_FOLLOW_PRICE_CREDITS`.
 *
 * # The division happens in LEDGER units, before the scale
 *
 * `displayPrice(ledger / faces)` and `displayPrice(ledger) / faces` agree at
 * today's figures and are not the same function. The second divides a number
 * that has already been rounded up and can land on a fraction, which
 * `formatCredits` would then print; the first rounds the real per-face charge
 * up exactly once, which is what `shared/creditDisplay.ts`'s asymmetry is for
 * — a price shown is never less than a price charged. So the ledger figure is
 * divided first and the scale is applied last, and the last step is the
 * branded helper, so no raw ledger number can reach a screen through here.
 *
 * # An unknown count omits the clause rather than guessing at it
 *
 * Every segment of the receipt is absent when the server did not send it
 * rather than defaulted to a literal — the lobby's own rule, written over
 * `candidatesPerRoll` in `client/src/pages/CastingV2.tsx`. A per-face figure
 * needs the count, so with no count there is no figure, and `null` is the only
 * honest answer. ⚠ **Never zero**: a price of nothing is a real and different
 * sentence from a price nobody has read yet (#1725, #1727), and
 * `server/unreadMoneyFigure.test.ts` bans the idiom under `client/src` for
 * exactly this family of nouns.
 *
 * The REFUND half of the sentence is true whatever the count is, so it is
 * stated on its own and the per-face clause joins it when there is one — the
 * `a sentence renders nothing` convention the refine rail already follows
 * (#1703).
 */
import { type DisplayCredits, displayPrice, formatCredits } from "./creditDisplay";

/**
 * What one face of a sheet costs, as a customer reads it.
 *
 * `sheetPriceLedger` is the whole sheet's charge in LEDGER units — the figure
 * `castingV2.config` sends as `rollPriceCredits` or `followPriceCredits`.
 * `facesPerSheet` is `candidatesPerRoll`.
 *
 * `null` when either number is missing, not a number, or not a positive count:
 * there is no per-face figure to state, and a zero would state one.
 */
export function perFaceDisplayCredits(
  sheetPriceLedger: number | null | undefined,
  facesPerSheet: number | null | undefined,
): DisplayCredits | null {
  if (typeof sheetPriceLedger !== "number" || !Number.isFinite(sheetPriceLedger)) return null;
  if (typeof facesPerSheet !== "number" || !Number.isInteger(facesPerSheet)) return null;
  if (sheetPriceLedger <= 0 || facesPerSheet <= 0) return null;
  return displayPrice(sheetPriceLedger / facesPerSheet);
}

/**
 * ⚠ **THE REFUND PROMISE IS THE PRODUCT'S, NOT THIS LINE'S** — D-109 and the
 * recovery sweep: a roll is eight independently refundable units, which is why
 * the price wears a tilde and why a face that never arrives costs nothing. The
 * sentence says it in the customer's words; the tilde beside the price is the
 * same fact in one character.
 */
export const RECEIPT_REFUND_CLAUSE = "Any face that doesn't arrive is refunded.";

/**
 * The one-line legend under the receipt, on hover and on focus.
 *
 * Takes the figure `perFaceDisplayCredits` produced, so a ledger number cannot
 * reach it and a typed one cannot either — the parameter is a
 * `DisplayCredits`, which only `shared/creditDisplay.ts` can mint.
 */
export function receiptLegend(perFace: DisplayCredits | null): string {
  if (perFace === null) return RECEIPT_REFUND_CLAUSE;
  /*
    ⚠ **TWO CLAUSES JOINED, NOT ONE TEMPLATE — AND THE CREDIT-DISPLAY GUARD IS
    RIGHT TO HAVE ASKED FOR IT.** Written as one literal
    (`` `${formatCredits(perFace)} credits a face. ${RECEIPT_REFUND_CLAUSE}` ``)
    it was indicted by rule 2: *"a number spliced into a sentence that says
    credits is a credit number whatever it is called"*. The clause is a STRING
    and the reader cannot see that — and a reader that could would be one
    `typeof` away from excusing a real ledger number on the same ground.

    So the sentence that says *credits* splices exactly one expression and that
    expression is the branded helper, which is the shape the guard's own
    `passes the same line once it is routed` arm pins. The join carries no
    price and says no price.
  */
  const perFaceClause = `${formatCredits(perFace)} credits a face.`;
  return [perFaceClause, RECEIPT_REFUND_CLAUSE].join(" ");
}
