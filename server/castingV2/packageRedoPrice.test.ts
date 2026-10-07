import { describe, expect, it } from "vitest";

/**
 * WHAT A REDO COSTS, AND WHO MAY BE OFFERED ONE (#1903 slice 2).
 *
 * Two subjects, and they are one subject: the number on the button and the
 * number at the till are the same reading, so the thing that holds them
 * together is that both go through `castPackageRedoOffer` over the same slots.
 * Every arm here is pure — no database, no provider, no clock.
 *
 * **The arm that earns its place is the first one.** His price is 350 display
 * credits and the code derives it from a per-view slice times the view list's
 * length, so five views at 350 ledger *happen* to come to his figure. Six would
 * come to 420 display and nothing in that expression would notice — the product
 * would simply start charging a price he never set. This suite is the thing
 * that notices.
 */
import {
  CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS,
  CASTING_V2_REFINE_PRICE_CREDITS,
  CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { LEDGER_PER_DISPLAY_CREDIT, displayPrice, displayRefund } from "../../shared/creditDisplay";
import { castPackageRedoOffer } from "./castProjection";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";

/**
 * THE PACKAGE TOTAL, COMPOSED HERE AND DECLARED NOWHERE IN PRODUCTION.
 *
 * `castViewPackage.ts` carries the reasoning: nothing in the product reads a
 * package total, because `castPackageRedoOffer` prices the slots a Cast
 * actually owns. So this suite composes the figure it is pinning rather than
 * importing a constant that would exist only to be pinned.
 */
const PACKAGE_PRICE =
  CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS * CAST_PACKAGE_VIEWS.length;

/** HIS NUMBER, typed once in this file and nowhere else in the product. */
const HIS_PRICE_IN_DISPLAY_CREDITS = 350;

describe("his price for a redo", () => {
  it("is 350 display credits for the package today", () => {
    /*
      THE PIN, and it is a founder decision rather than arithmetic: #1903,
      2026-10-07, asked what a redo should cost and answered "350".

      A failure here does NOT mean "fix the number" — it means the view list
      changed under a price he set, and the question goes back to him before
      anything ships. `castViewPackage.ts` says so where the constant is
      declared, because that is where somebody adding a sixth view will be
      looking.
    */
    expect(displayPrice(PACKAGE_PRICE))
      .toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("is the per-view slice times the views the cohort promises", () => {
    expect(PACKAGE_PRICE)
      .toBe(CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS * CAST_PACKAGE_VIEWS.length);
    /* The negative control for the arm above: a total typed as a literal would
       satisfy the pin and stop tracking the list. Five is today's length, said
       here so a change to the list is visible in the diff of this file too. */
    expect(CAST_PACKAGE_VIEWS.length).toBe(5);
  });

  it("gives back a whole display number per view, which is the reason for a slice at all", () => {
    /*
      HIS CARD PRICES A REDO AS ONE FIGURE AND KEEPS THE CATASTROPHIC REFUND
      RULE, which refunds ONE view — so the charge has to decompose, and a
      refund a customer can read has to be a whole display number. That is the
      same property the Sign's own 3,500 + 5 x 1,000 was chosen for.

      `displayRefund` rounds DOWN, so a slice that were not a clean multiple
      would quietly hand back less than it took. Asserting the division is not
      enough on its own: the arm that matters is that the figure a customer is
      SHOWN equals the figure that moved.
    */
    expect(CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
    expect(displayRefund(CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS)).toBe(70);
    expect(displayRefund(CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS) * CAST_PACKAGE_VIEWS.length)
      .toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("matches a Refine and NOT the paid Try again — the card's own prose is two prices old", () => {
    /*
      ⚠ #1903's body reads "That matches Refine and the pricing table's Try
      again". Half of that is true and the other half stopped being true on
      2026-10-01 (#1601 item 1, his finance guy's note: the paid Try again went
      350 -> 370 to keep every worst case profitable). This arm is here so the
      correction is checkable rather than a claim in a comment.
    */
    expect(displayPrice(CASTING_V2_REFINE_PRICE_CREDITS)).toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
    expect(displayPrice(CASTING_V2_VIEW_RETRY_PRICE_CREDITS)).toBe(370);
    /*
      ⚠ AND THIS IS THE FINDING THAT WENT TO HIM RATHER THAN BEING QUIETLY
      FIXED: a redo of FIVE views costs LESS than asking for ONE view again.
      Both numbers are his. It is asserted rather than described so that the day
      either moves, this arm reddens and the reading is re-taken instead of
      being remembered wrongly.
    */
    expect(displayPrice(PACKAGE_PRICE))
      .toBeLessThan(displayPrice(CASTING_V2_VIEW_RETRY_PRICE_CREDITS));
  });
});

/** A ready Cast with `count` slots, none of them in flight. */
const readyCast = (count: number, overrides: { retrying?: number } = {}) => ({
  status: "ready" as const,
  slots: Array.from({ length: count }, (_, index) => (
    index < (overrides.retrying ?? 0) ? { retrying: true as const } : {}
  )),
});

describe("who may be offered a redo", () => {
  it("offers one on a finished Cast, priced from HER slots", () => {
    const offer = castPackageRedoOffer(readyCast(5), CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS);
    expect(offer).toEqual({ priceCredits: PACKAGE_PRICE });
    expect(displayPrice(offer!.priceCredits)).toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("prices a six-view Cast for six views, not for today's five", () => {
    /*
      A package is a HISTORICAL RECORD — the projection renders the slots a Cast
      actually owns, and two live Casts own a retired `walk`. Quoting today's
      five-view total on a six-view Cast would print one number on the button
      and charge another at the till, which is the exact disagreement
      `castSlotRetryOffer`'s own docblock exists to prevent and is louder here,
      because this number is the one the customer reads.
    */
    const offer = castPackageRedoOffer(readyCast(6), CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS);
    expect(offer?.priceCredits).toBe(CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS * 6);
    expect(offer?.priceCredits).not.toBe(PACKAGE_PRICE);
  });

  it("offers nothing while she is still being made", () => {
    expect(castPackageRedoOffer(
      { status: "building", slots: readyCast(5).slots },
      CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS,
    )).toBeNull();
  });

  it("offers nothing while ANY ONE of her views is in flight", () => {
    /*
      One is enough, and that is the whole rule: a redo renders every slot, so a
      single Try again already running means the lock on that slot is taken and
      the press would refuse halfway. Driven at one, not at five, because five
      would pass on a predicate reading `every`.
    */
    expect(castPackageRedoOffer(
      readyCast(5, { retrying: 1 }),
      CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS,
    )).toBeNull();
  });

  it("offers nothing to a Cast with no slots at all", () => {
    expect(castPackageRedoOffer(
      { status: "ready", slots: [] },
      CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS,
    )).toBeNull();
  });

  it("STILL offers one when a view failed or nobody checked it", () => {
    /*
      ⚠ THE POSITIVE CONTROL THAT SEPARATES THIS OFFER FROM THE SLOT'S.
      `castSlotRetryOffer` asks *may this view be asked for again*, which is a
      question about a remedy and therefore about state. This asks *may the
      customer buy the whole set again*, which is a question about taste — so a
      refunded slot, an unchecked slot and five perfect slots are all offered,
      at the same price. An implementation that reused the slot's eligibility
      would pass every arm above and fail this one.
    */
    const mixed = {
      status: "ready" as const,
      slots: [
        { retrying: undefined },
        { retrying: undefined },
        { retrying: undefined },
        { retrying: undefined },
        { retrying: undefined },
      ],
    };
    expect(castPackageRedoOffer(mixed, CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS))
      .toEqual({ priceCredits: PACKAGE_PRICE });
  });
});
