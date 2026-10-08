/**
 * NO CUSTOMER-FACING CREDIT AMOUNT MAY DISPLAY AS LESS THAN ONE CREDIT (#1600).
 *
 * # The sentence this exists to keep off the screen
 *
 * A customer reads credits at a fifth of what the ledger stores, and the
 * conversion rounds DOWN for anything they HAVE. So a refund of four ledger
 * credits displays as **zero** — and `cancelNotice.ts` was written, on a
 * founder finding, precisely to delete the sentence *"Cancelled · 0 credits
 * back"*.
 *
 * Two repairs were considered inside that file and BOTH are wrong:
 *
 *   - **Branch on the ledger, print the display.** A refund that happened
 *     prints as zero. That is the original defect.
 *   - **Branch on the display.** A refund that happened falls through to
 *     *"there was nothing to refund"* — false, and against R6's refund-honesty
 *     law, which says a non-zero refund states its number.
 *
 * There is no third sentence worth inventing, because the state is not
 * reachable: the smallest refundable unit the product has is one sheet slice,
 * and no declared price in the tree is small enough to display as nothing. So
 * the branches stay on the LEDGER, only the printed number is converted, and
 * **this suite is what keeps the premise true.** The day a price makes a
 * sub-one-credit refund possible, this goes red — and a third branch becomes
 * somebody's deliberate decision rather than a customer's surprise.
 *
 * # Why it reads the real constants and not a list
 *
 * A fixture would pass forever. These are the modules P1-2 is about to edit
 * (`#1601` moves every one of the casting numbers), so the arm has to read what
 * the product actually declares. `displayPrice` is `ceil`, so a PRICE can never
 * display as zero; it is the floor on amounts handed BACK — refunds, grants,
 * rewards — that has to be asserted, and those are the same constants a charge
 * is built from.
 */
import { describe, expect, it } from "vitest";

import {
  CASTING_V2_COSTS,
  CASTING_V2_SIGN_PRICE_CREDITS,
  CREDIT_COSTS,
} from "./casting/castingCreditCosts";
import { displayBalance, displayPrice, displayRefund } from "../shared/creditDisplay";

/**
 * Every ledger amount the product can hand BACK to a customer, by the name it
 * is declared under.
 *
 * ⚠ **`flashMultiplier` is deliberately absent and it is the interesting
 * one.** It is `0.5`, not a credit amount — it halves a cost — so a refund
 * built from it is `cost × 0.5`, and the halved products of the amounts here
 * are asserted separately below. Listing the multiplier itself would assert
 * that one-half of a credit displays as a credit, which is both false and not
 * a claim anybody needs.
 */
const REFUNDABLE_LEDGER_AMOUNTS: readonly { name: string; ledger: number }[] = [
  { name: "CASTING_V2_COSTS.rollCandidate", ledger: CASTING_V2_COSTS.rollCandidate },
  /* ⚠ **ONE ROW WHERE THERE WERE TWO — #1968.** `CASTING_V2_SIGN_COSTS.promotion`
     and `.view` were the Sign’s two refundable parts; his flat price makes the
     whole charge the only thing that can be handed back, so the amount this
     floor has to hold is that one figure. */
  { name: "CASTING_V2_SIGN_PRICE_CREDITS", ledger: CASTING_V2_SIGN_PRICE_CREDITS },
  { name: "CREDIT_COSTS.castingImage", ledger: CREDIT_COSTS.castingImage },
  { name: "CREDIT_COSTS.fullBody", ledger: CREDIT_COSTS.fullBody },
  { name: "CREDIT_COSTS.multiView", ledger: CREDIT_COSTS.multiView },
  { name: "CREDIT_COSTS.allViews", ledger: CREDIT_COSTS.allViews },
  { name: "CREDIT_COSTS.iterate", ledger: CREDIT_COSTS.iterate },
  { name: "CREDIT_COSTS.eraser", ledger: CREDIT_COSTS.eraser },
];

describe("#1600 — a refund the product can make always displays as at least one credit", () => {
  it("every refundable declared amount survives the conversion", () => {
    const vanish = REFUNDABLE_LEDGER_AMOUNTS.filter((amount) => displayRefund(amount.ledger) < 1).map(
      (amount) => `${amount.name} = ${amount.ledger} ledger → ${displayRefund(amount.ledger)} displayed`,
    );
    expect(vanish).toEqual([]);
  });

  it("and so does HALF of one, which is what the Flash fallback charges", () => {
    /* `CREDIT_COSTS.flashMultiplier` halves a cost, so the refund of a
       Flash-served generation is half of one of the amounts above. That is the
       smallest refund this product can actually produce. */
    const vanish = REFUNDABLE_LEDGER_AMOUNTS.filter(
      (amount) => displayRefund(amount.ledger * CREDIT_COSTS.flashMultiplier) < 1,
    ).map((amount) => `${amount.name} halved = ${amount.ledger * CREDIT_COSTS.flashMultiplier} ledger`);
    expect(vanish).toEqual([]);
  });

  it("⚠ the positive control — the arm really can fail", () => {
    /* Law 2: a floor that cannot be breached is not a floor. Four ledger
       credits is the largest amount that still displays as nothing, and if this
       assertion ever stops holding the conversion has changed and every
       sentence above it needs re-reading. */
    expect(displayRefund(4)).toBe(0);
    expect(displayRefund(5)).toBe(1);
  });

  it("a PRICE can never display as zero, which is why only refunds are floored", () => {
    /* `displayPrice` is `ceil`, so any positive cost shows at least 1 — the
       reason "Free" checks in the client stay on the ledger value. */
    for (const amount of REFUNDABLE_LEDGER_AMOUNTS) {
      expect(displayPrice(amount.ledger)).toBeGreaterThanOrEqual(1);
    }
    expect(displayPrice(1)).toBe(1);
    expect(displayPrice(0)).toBe(0);
  });

  it("a balance rounds DOWN and a price rounds UP, so neither ever flatters", () => {
    /* The card's own property tests, read here against the real amounts rather
       than against chosen numbers: a shown balance is never more than what can
       be spent, and a shown price never less than what is charged. */
    for (const amount of REFUNDABLE_LEDGER_AMOUNTS) {
      expect(displayBalance(amount.ledger) * 5).toBeLessThanOrEqual(amount.ledger);
      expect(displayPrice(amount.ledger) * 5).toBeGreaterThanOrEqual(amount.ledger);
    }
  });
});
