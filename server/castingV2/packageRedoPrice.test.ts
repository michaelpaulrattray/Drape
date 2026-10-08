import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { withoutComments } from "../testing/withoutComments";

/**
 * WHAT A REDO COSTS, AND WHO MAY BE OFFERED ONE (#1903 slice 2).
 *
 * Two subjects, and they are one subject: the number on the button and the
 * number at the till are the same reading, so the thing that holds them
 * together is that both go through `castPackageRedoOffer` over one constant.
 * Every arm here is pure — no database, no provider, no clock.
 *
 * ⚠ **THIS SUITE USED TO PIN AN ARITHMETIC COINCIDENCE, AND NOW IT PINS A
 * NUMBER HE SET.** The price was a per-view slice of 350 ledger, five of which
 * *happened* to come to his 350 display; six views would have come to 420 and
 * no expression anywhere would have noticed. His word of 2026-10-08 (on #1968)
 * ends that shape: *"on this card make both sign and redo/regenerate 650
 * credis"* — one flat price for the press, whatever she owns. So the arm that
 * earns its place now is a different one: that **no per-slot price for this
 * road has come back**, because the slice-refund arithmetic is one `/ 5` away
 * from being re-added by somebody reading an older comment.
 */
import {
  CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
  CASTING_V2_REFINE_PRICE_CREDITS,
  CASTING_V2_VIEW_RETRY_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { LEDGER_PER_DISPLAY_CREDIT, displayPrice, displayRefund } from "../../shared/creditDisplay";
import { flatPressRefundOwed } from "../casting/flatPressCharge";
import { castPackageRedoOffer } from "./castProjection";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";

/** HIS NUMBER, typed once in this file and nowhere else in the product. */
const HIS_PRICE_IN_DISPLAY_CREDITS = 650;

describe("his price for a redo", () => {
  it("is 650 display credits for the whole press", () => {
    /*
      THE PIN, and it is a founder decision rather than arithmetic: #1968,
      2026-10-08, *"on this card make both sign and redo/regenerate 650 credis"*.

      A failure here does NOT mean "fix the number" — it means a price he set
      has moved, and the question goes back to him before anything ships.
    */
    expect(displayPrice(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
      .toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
    expect(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS).toBe(3250);
  });

  it("does not depend on how many views she owns", () => {
    /*
      ⚠ THE PROPERTY THE OLD PRICE DID NOT HAVE. Two live Casts own a retired
      `walk`, so the offer sees six slots on them. Under the slice the button
      read 420 display on those Casts; under his flat price every Cast reads
      650, and this is the arm that says so from the OFFER rather than from the
      constant.
    */
    for (const slots of [1, 5, 6]) {
      expect(castPackageRedoOffer(readyCast(slots), CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
        .toEqual({ priceCredits: CASTING_V2_PACKAGE_REDO_PRICE_CREDITS });
    }
    /* Five is today's length, said here so a change to the list is visible in
       the diff of this file too — and so the arm above is known to be testing
       something other than today's number. */
    expect(CAST_PACKAGE_VIEWS.length).toBe(5);
  });

  it("⚠ NO PER-SLOT PRICE FOR THIS ROAD EXISTS, and that absence is the control", () => {
    /*
      The relay's finding on PR #1924: *"Do not keep a per-slot constant as a
      back door to slice refunds."* A surviving `*_VIEW_PRICE_CREDITS` for the
      redo would leave the slice arithmetic sitting there one division away
      from being re-added, and the first reader to re-add it would be obeying a
      comment rather than his ruling.

      Read at the SOURCE rather than at the exports, because a constant that is
      declared and not exported is the same back door one keystroke later.
    */
    /* ⚠ THE CODE, NOT THE PROSE. The constant's own docblock NAMES the old
       spelling — it has to, because it is the record of what the price used to
       be and why it moved — so a reader that matched comments would refuse the
       explanation of its own rule. */
    const costs = withoutComments(readFileSync(
      new URL("../casting/castingCreditCosts.ts", import.meta.url),
      "utf8",
    ));
    expect(costs).toContain("CASTING_V2_PACKAGE_REDO_PRICE_CREDITS");
    expect(
      costs,
      "a per-view price for the redo is back — his price is flat and a slice cannot be refunded",
    ).not.toContain("CASTING_V2_PACKAGE_REDO_VIEW_PRICE_CREDITS");
    /* The reader is shown able to find a name that IS there, so the assertion
       above is not passing on a mis-read file (law 2). */
    expect(costs).toContain("CASTING_V2_VIEW_RETRY_PRICE_CREDITS");
  });

  it("is a whole display number, so what a customer is shown is what moved", () => {
    /*
      `displayRefund` rounds DOWN, so a price that were not a clean multiple
      would quietly hand back less than it took on the one refund this road can
      make. Asserting the division is not enough on its own: the arm that
      matters is that the figure a customer is SHOWN equals the figure that
      moved.
    */
    expect(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
    expect(displayRefund(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
      .toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("is the only refund this road can make, and only when nothing arrived", () => {
    /*
      His rule, through the shared decision both the live service and the
      recovery sweep ask: *"Credits only come back if the Sign can't be
      delivered at all."*
    */
    const charged = CASTING_V2_PACKAGE_REDO_PRICE_CREDITS;
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 0 })).toBe(charged);
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 1 })).toBe(0);
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 5 })).toBe(0);
  });

  it("costs more than one paid Try again, which the per-view price did not", () => {
    /*
      ⚠ THE FINDING THE OLD PRICE CARRIED, now closed by his own number: a redo
      of FIVE views used to cost LESS (350) than asking for ONE view again
      (370). At 650 the whole set is dearer than a single slot, which is the
      only ordering that does not reward pressing the bigger button.
    */
    expect(displayPrice(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
      .toBeGreaterThan(displayPrice(CASTING_V2_VIEW_RETRY_PRICE_CREDITS));
    /* And it is no longer the Refine's twin either — the card's prose said so
       when both were 350. */
    expect(displayPrice(CASTING_V2_REFINE_PRICE_CREDITS)).toBe(350);
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
  it("offers one on a finished Cast", () => {
    const offer = castPackageRedoOffer(readyCast(5), CASTING_V2_PACKAGE_REDO_PRICE_CREDITS);
    expect(offer).toEqual({ priceCredits: CASTING_V2_PACKAGE_REDO_PRICE_CREDITS });
    expect(displayPrice(offer!.priceCredits)).toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("offers nothing while she is still being made", () => {
    expect(castPackageRedoOffer(
      { status: "building", slots: readyCast(5).slots },
      CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
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
      CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
    )).toBeNull();
  });

  it("offers nothing to a Cast with no slots at all", () => {
    expect(castPackageRedoOffer(
      { status: "ready", slots: [] },
      CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
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
    expect(castPackageRedoOffer(mixed, CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
      .toEqual({ priceCredits: CASTING_V2_PACKAGE_REDO_PRICE_CREDITS });
  });
});
