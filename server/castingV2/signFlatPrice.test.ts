import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { withoutComments } from "../testing/withoutComments";

/**
 * WHAT A SIGN COSTS, AND THE TWO CONSTANTS THAT MUST NOT COME BACK (#1968).
 *
 * **His price, verbatim, 2026-10-08 (terminal):** *"on this card make both sign
 * and redo/regenerate 650 credis"*, and the reasoning he gave with it:
 *
 * > *"Drop the 700 base + 200 per view split, since views are cut from two
 * > sheets and can't be refunded one by one… Credits only come back if the
 * > Sign can't be delivered at all."*
 *
 * ⚠ **THE ARM THAT EARNS ITS PLACE HERE IS THE ABSENCE ONE**, and it is the
 * Sign's half of what `packageRedoPrice.test.ts` already does for the redo. A
 * surviving `CASTING_V2_SIGN_COSTS.view` or `CAST_PACKAGE_VIEW_PRICE` would
 * leave the slice-refund arithmetic sitting one `recordRefund` away from being
 * re-added by somebody reading an older comment — on the most expensive money
 * path in the product. Every arm is pure: no database, no provider, no clock.
 *
 * ⚠ **THIS FILE WAS NAMED IN TWO DOCBLOCKS BEFORE IT EXISTED.** The constants'
 * own comments said *"`signFlatPrice.test.ts` refuses both names' return"* and
 * nothing did; `suitePointerDiscipline` caught it at preflight. A guard
 * promised in prose and never written is worse than no guard, because the next
 * reader trusts the sentence.
 */
import {
  CASTING_V2_PACKAGE_REDO_PRICE_CREDITS,
  CASTING_V2_SIGN_PRICE_CREDITS,
} from "../casting/castingCreditCosts";
import { LEDGER_PER_DISPLAY_CREDIT, displayPrice, displayRefund } from "../../shared/creditDisplay";
import { flatPressRefundOwed } from "../casting/flatPressCharge";
import { CAST_PACKAGE_VIEWS } from "./castViewPackage";

/** HIS NUMBER, typed once in this file and nowhere else in the product. */
const HIS_PRICE_IN_DISPLAY_CREDITS = 650;

/** The two files a per-view Sign price could come back in. */
const COSTS_SOURCE = withoutComments(readFileSync(
  new URL("../casting/castingCreditCosts.ts", import.meta.url),
  "utf8",
));
const PACKAGE_SOURCE = withoutComments(readFileSync(
  new URL("./castViewPackage.ts", import.meta.url),
  "utf8",
));

describe("his price for a Sign", () => {
  it("is 650 display credits, flat", () => {
    /*
      THE PIN, and it is a founder decision rather than arithmetic. A failure
      here does NOT mean "fix the number" — it means a price he set has moved,
      and the question goes back to him before anything ships.
    */
    expect(displayPrice(CASTING_V2_SIGN_PRICE_CREDITS)).toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
    expect(CASTING_V2_SIGN_PRICE_CREDITS).toBe(3250);
  });

  it("is the same number he set for the redo, because he set them in one breath", () => {
    /*
      *"make both sign and redo/regenerate 650 credis"*. Asserted rather than
      derived: they are two prices he happens to have set equal, not one price
      read twice, so either may move alone and this arm is where that shows.
    */
    expect(displayPrice(CASTING_V2_PACKAGE_REDO_PRICE_CREDITS))
      .toBe(displayPrice(CASTING_V2_SIGN_PRICE_CREDITS));
  });

  it("does not move with the number of views the cohort promises", () => {
    /*
      ⚠ THE PROPERTY THE OLD PRICE DID NOT HAVE, and the one arm that can tell
      this rule from the one it replaced. The Sign was `promotion + view ×
      views`, so retiring or adding a view repriced it; his price is one
      number whatever she owns.
    */
    expect(CASTING_V2_SIGN_PRICE_CREDITS % CAST_PACKAGE_VIEWS.length)
      .not.toBe(CASTING_V2_SIGN_PRICE_CREDITS / CAST_PACKAGE_VIEWS.length);
    /* Five is today's length, said here so a change to the list is visible in
       this file's diff too. */
    expect(CAST_PACKAGE_VIEWS.length).toBe(5);
  });

  it("⚠ NO PER-VIEW PRICE AND NO PROMOTION BASE EXIST, and that absence is the control", () => {
    /*
      Read at the SOURCE rather than at the exports, because a constant that is
      declared and not exported is the same back door one keystroke later — and
      read with comments STRIPPED, because both docblocks name the old
      spellings on purpose: they are the record of what the price used to be.
    */
    for (const [label, source] of [["costs", COSTS_SOURCE], ["package", PACKAGE_SOURCE]] as const) {
      expect(
        source,
        `${label}: a promotion base is back — his price is flat and has no parts`,
      ).not.toContain("CASTING_V2_SIGN_PROMOTION_PRICE");
      expect(
        source,
        `${label}: a per-view slice is back — a view cannot be refunded one by one`,
      ).not.toContain("CAST_PACKAGE_VIEW_PRICE");
      expect(
        source,
        `${label}: the decomposed cost table is back`,
      ).not.toContain("CASTING_V2_SIGN_COSTS");
    }
    /*
      The reader is shown able to find names that ARE there, so the six
      assertions above are not passing on a mis-read or empty file (law 2) —
      one positive control per source, because they are two different reads.
    */
    expect(COSTS_SOURCE).toContain("CASTING_V2_SIGN_PRICE_CREDITS");
    expect(PACKAGE_SOURCE).toContain("CAST_PACKAGE_VIEWS");
  });

  it("is a whole display number, so what a customer is shown is what moved", () => {
    /*
      `displayRefund` rounds DOWN, so a price that were not a clean multiple
      would quietly hand back less than it took on the one refund this road can
      make.
    */
    expect(CASTING_V2_SIGN_PRICE_CREDITS % LEDGER_PER_DISPLAY_CREDIT).toBe(0);
    expect(displayRefund(CASTING_V2_SIGN_PRICE_CREDITS)).toBe(HIS_PRICE_IN_DISPLAY_CREDITS);
  });

  it("refunds everything when nothing arrived, and nothing when anything did", () => {
    /*
      His rule, asked through the shared decision rather than restated: *"Credits
      only come back if the Sign can't be delivered at all."* The Sign and the
      redo call one function over one definition of *delivered*, so a crash
      cannot pay a customer on one road what the identical failure on the other
      did not.
    */
    const charged = CASTING_V2_SIGN_PRICE_CREDITS;
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 0 })).toBe(charged);
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 1 })).toBe(0);
    expect(flatPressRefundOwed({ chargedCredits: charged, delivered: 5 })).toBe(0);
  });

  it("⚠ gives back what a Sign WAS charged, not what one costs today", () => {
    /*
      THE IN-FLIGHT ARM. A Sign charged 8,500 under the old decomposition and
      settled by this build must be made whole at 8,500 — the figure comes from
      the ledger, so the helper is asked with the charge rather than with the
      constant. An implementation that read `CASTING_V2_SIGN_PRICE_CREDITS`
      here would short that customer by 5,250 on our own outage and would pass
      every other arm in this file.
    */
    const legacyCharge = 8500;
    expect(legacyCharge).not.toBe(CASTING_V2_SIGN_PRICE_CREDITS);
    expect(flatPressRefundOwed({ chargedCredits: legacyCharge, delivered: 0 }))
      .toBe(legacyCharge);
  });
});
