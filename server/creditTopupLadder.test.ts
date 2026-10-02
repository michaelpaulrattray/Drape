/**
 * THE TOP-UP LADDER, DRIVEN (#1606, P1-7) — the arithmetic that decides what a
 * customer is charged for credits, and the one sentence in the record it
 * corrects.
 *
 * # The reading these arms are pinned against
 *
 * His ruling of 2026-10-02 (terminal, recorded verbatim in
 * `.agents/foreman/PROGRAM.md`): three packs plus a 5,000-step slider, at
 * **$12 / $11 / $10 per 5,000 credits** in the brackets **1 · 2–4 · 5+**, so
 * the packs are **5,000 = $12 · 10,000 = $22 · 25,000 = $50**. His own hand
 * then created exactly those three prices in Stripe's test mode the same hour,
 * per 5,000 credits: 1200¢, 1100¢, 1000¢ (the ids are on #1606). Both halves of
 * that are READINGS, and every figure below is held against them.
 *
 * # ⚠ The negative control that is the point of this file
 *
 * The same record also describes the slider as *"charged as the 5,000 pack's
 * Stripe price with quantity"* — true of the FLAT ladder it was written under
 * ($12 / $24 / $60), false under the volume one, where $12 × 2 is $24 and his
 * own 10,000 pack is $22. Taken literally the slider would sell the same
 * credits for more money than the pack sitting beside it. The arm named *the
 * superseded flat reading* drives that arithmetic and asserts it is NOT what
 * this product charges — so the day somebody "simplifies" the bracket read back
 * to one price times quantity, it reddens with the reason in its own name.
 *
 * # Why the plan-nudge arm reads `PLAN_TIERS`
 *
 * The surface his design asks for says *a bigger plan gives more for the
 * money*, and that sentence is only honest while every rate on this ladder is
 * worse than the cheapest plan's. Derived from the plan table rather than
 * compared against a typed 519, because the figure that matters is whatever the
 * plans actually charge today — the one on #1602 moved once already.
 */
import { describe, expect, it } from "vitest";
import {
  LEDGER_PER_DISPLAY_CREDIT,
  displayBalance,
} from "@shared/creditDisplay";
import {
  TOPUP_BRACKETS,
  TOPUP_MAX_UNITS,
  TOPUP_NEEDS_A_PLAN_SENTENCE,
  TOPUP_PACKS,
  TOPUP_UNIT_DISPLAY_CREDITS,
  TOPUP_UNIT_LEDGER_CREDITS,
  isSellableTopupUnits,
  topupBracketFor,
  topupBracketPackSize,
  topupDisplayCredits,
  topupEligibility,
  topupLedgerCredits,
  topupPriceInCents,
} from "@shared/creditTopups";
import { PLAN_TIERS } from "../drizzle/schema";

/** His ruling's three packs: display credits → dollars. */
const HIS_PACKS = [
  { displayCredits: 5_000, cents: 1_200 },
  { displayCredits: 10_000, cents: 2_200 },
  { displayCredits: 25_000, cents: 5_000 },
];

/** His ruling's three bands: the first unit count in the band → cents a unit. */
const HIS_BANDS = [
  { fromUnits: 1, centsPerUnit: 1_200 },
  { fromUnits: 2, centsPerUnit: 1_100 },
  { fromUnits: 5, centsPerUnit: 1_000 },
];

describe("the ladder is the one he ruled, band for band", () => {
  it("carries exactly his three bands, in his order", () => {
    expect(TOPUP_BRACKETS.map((b) => ({ ...b }))).toEqual(HIS_BANDS);
  });

  it("the unit is 5,000 credits, which is the slider's step and the smallest pack", () => {
    expect(TOPUP_UNIT_DISPLAY_CREDITS).toBe(5_000);
    expect(TOPUP_PACKS[0].displayCredits).toBe(TOPUP_UNIT_DISPLAY_CREDITS);
  });

  it("the three packs are 5,000/$12 · 10,000/$22 · 25,000/$50, DERIVED from the bands", () => {
    expect(
      TOPUP_PACKS.map((p) => ({ displayCredits: p.displayCredits, cents: p.cents })),
    ).toEqual(HIS_PACKS);
    /* Derived, so the population cannot silently shrink: three bands, three
       packs, and each pack is its own band's first order. */
    expect(TOPUP_PACKS.length).toBe(TOPUP_BRACKETS.length);
    TOPUP_PACKS.forEach((pack, i) => {
      expect(pack.units).toBe(TOPUP_BRACKETS[i].fromUnits);
      expect(pack.displayCredits).toBe(topupBracketPackSize(TOPUP_BRACKETS[i]));
    });
  });

  it("the pack sizes are the three sizes his Stripe keys are named for", () => {
    expect(TOPUP_BRACKETS.map(topupBracketPackSize)).toEqual([5_000, 10_000, 25_000]);
  });
});

describe("the ladder's shape — a volume discount, held to being one", () => {
  it("starts at one unit, so no order can fall outside every band", () => {
    expect(TOPUP_BRACKETS[0].fromUnits).toBe(1);
  });

  it("the bands ascend and the rate strictly falls at every step", () => {
    for (let i = 1; i < TOPUP_BRACKETS.length; i++) {
      expect(TOPUP_BRACKETS[i].fromUnits).toBeGreaterThan(TOPUP_BRACKETS[i - 1].fromUnits);
      expect(TOPUP_BRACKETS[i].centsPerUnit).toBeLessThan(TOPUP_BRACKETS[i - 1].centsPerUnit);
    }
  });

  it("buying more credits never costs less money, at every sellable size", () => {
    /* The property a bracketed ladder can break and a flat one cannot: a rate
       that falls at a band boundary could make a bigger order cheaper in total
       than a smaller one, and a customer would be charged more for less. */
    for (let units = 2; units <= TOPUP_MAX_UNITS; units++) {
      expect(topupPriceInCents(units)).toBeGreaterThan(topupPriceInCents(units - 1));
    }
  });

  it("every band is reachable — each one answers for its own first order", () => {
    for (const band of TOPUP_BRACKETS) {
      expect(topupBracketFor(band.fromUnits).centsPerUnit).toBe(band.centsPerUnit);
    }
  });

  it("an order inside a band pays that band's rate, not the next one's", () => {
    // 2–4 is the only band with room inside it under his ruling.
    expect(topupPriceInCents(3)).toBe(1_100 * 3);
    expect(topupPriceInCents(4)).toBe(1_100 * 4);
    expect(topupPriceInCents(5)).toBe(1_000 * 5);
  });
});

describe("⚠ the superseded flat reading is NOT what this product charges", () => {
  it("the slider at a pack's size costs exactly the pack", () => {
    for (const pack of TOPUP_PACKS) {
      expect(topupPriceInCents(pack.units)).toBe(pack.cents);
    }
  });

  it("'the 5,000 pack's price with quantity' overcharges from two units up", () => {
    const flat = (units: number) => TOPUP_BRACKETS[0].centsPerUnit * units;
    /* The one unit where the two readings agree — which is why reading the
       record literally looks right until somebody buys two. */
    expect(flat(1)).toBe(topupPriceInCents(1));
    for (let units = 2; units <= TOPUP_MAX_UNITS; units++) {
      expect(topupPriceInCents(units)).toBeLessThan(flat(units));
    }
    /* His own figures, named: the 10,000 pack is $22 and the flat reading would
       have charged $24 for the same credits. */
    expect(topupPriceInCents(2)).toBe(2_200);
    expect(flat(2)).toBe(2_400);
  });
});

describe("credits granted are the product's one scale, not a second copy of ÷5", () => {
  it("a unit is 5,000 display credits and 25,000 ledger credits", () => {
    expect(TOPUP_UNIT_LEDGER_CREDITS).toBe(25_000);
    expect(TOPUP_UNIT_LEDGER_CREDITS).toBe(
      TOPUP_UNIT_DISPLAY_CREDITS * LEDGER_PER_DISPLAY_CREDIT,
    );
  });

  it("what is granted reads back as what was offered, through the real display helper", () => {
    for (let units = 1; units <= TOPUP_MAX_UNITS; units++) {
      expect(displayBalance(topupLedgerCredits(units))).toBe(topupDisplayCredits(units));
    }
  });

  it("his three packs grant 25,000 / 50,000 / 125,000 ledger credits", () => {
    expect(TOPUP_PACKS.map((p) => topupLedgerCredits(p.units))).toEqual([
      25_000, 50_000, 125_000,
    ]);
  });
});

describe("the bound, and the counts this product refuses to price", () => {
  it("sells one unit up to the stated maximum and nothing else", () => {
    expect(isSellableTopupUnits(1)).toBe(true);
    expect(isSellableTopupUnits(TOPUP_MAX_UNITS)).toBe(true);
    expect(isSellableTopupUnits(TOPUP_MAX_UNITS + 1)).toBe(false);
    expect(isSellableTopupUnits(0)).toBe(false);
    expect(isSellableTopupUnits(-1)).toBe(false);
  });

  it("a fraction, an infinity and a NaN are all refused rather than floored", () => {
    for (const bad of [1.5, 0.2, Infinity, -Infinity, NaN]) {
      expect(isSellableTopupUnits(bad)).toBe(false);
    }
  });

  it("the money functions THROW on an unsellable count rather than answering", () => {
    /* A price helper that answered 0 or NaN for a bad count would put that
       number on a wire. Every one of the three refuses. */
    for (const bad of [0, -1, 1.5, NaN, TOPUP_MAX_UNITS + 1]) {
      expect(() => topupBracketFor(bad)).toThrow(RangeError);
      expect(() => topupPriceInCents(bad)).toThrow(RangeError);
      expect(() => topupLedgerCredits(bad)).toThrow(RangeError);
      expect(() => topupDisplayCredits(bad)).toThrow(RangeError);
    }
  });

  it("the refusal names what this product sells, so a wrong call is readable", () => {
    expect(() => topupBracketFor(0)).toThrow(/not a top-up this product sells/);
    expect(() => topupBracketFor(99)).toThrow(new RegExp(String(TOPUP_MAX_UNITS)));
  });
});

describe("the nudge stays true — every top-up rate is worse than the cheapest plan's", () => {
  /** Display credits per dollar, on the plan table's own figures. */
  function planCreditsPerDollar(tier: { monthlyCredits: number; price: number }): number {
    return displayBalance(tier.monthlyCredits) / (tier.price / 100);
  }

  it("is measured against the cheapest PAID plan, read from the table", () => {
    const paid = Object.values(PLAN_TIERS).filter((tier) => tier.price > 0);
    /* The population control: a filter that returned nothing would make the
       comparison below vacuous and the surface's sentence unproven. */
    expect(paid.length).toBeGreaterThanOrEqual(7);

    const cheapestRate = Math.min(...paid.map(planCreditsPerDollar));
    expect(cheapestRate).toBeGreaterThan(0);

    for (const band of TOPUP_BRACKETS) {
      const topupRate = TOPUP_UNIT_DISPLAY_CREDITS / (band.centsPerUnit / 100);
      expect(topupRate).toBeLessThan(cheapestRate);
    }
  });

  it("the best top-up rate is 500 credits a dollar and the worst plan's is above it", () => {
    /* The numbers from his ruling, so the arm above cannot pass by comparing
       two figures that both moved. */
    const best = TOPUP_UNIT_DISPLAY_CREDITS / (TOPUP_BRACKETS[2].centsPerUnit / 100);
    expect(best).toBe(500);
    expect(planCreditsPerDollar(PLAN_TIERS.starter)).toBeGreaterThan(500);
  });
});

describe("who may buy — the plan rung, and the unread state it must not confuse", () => {
  it("a plan holder may buy", () => {
    for (const tier of Object.keys(PLAN_TIERS).filter((t) => t !== "free")) {
      expect(topupEligibility(tier)).toBe("may-buy");
    }
  });

  it("a free account is told to pick a plan", () => {
    expect(topupEligibility("free")).toBe("needs-a-plan");
  });

  it("⚠ a plan nobody has read yet is NEITHER — the eight-defect class on this surface", () => {
    /* #1703, #1725, #1727, #1730, #1741, #1747, #1749, #1755. A boolean here
       would read as `false`, which on this question means "you have no plan",
       and a Pro subscriber would be shown the upgrade offer mid-load. */
    expect(topupEligibility(undefined)).toBe("unread");
    expect(topupEligibility(null)).toBe("unread");
    expect(topupEligibility("")).toBe("unread");
    expect(topupEligibility("free")).not.toBe("unread");
  });

  it("the refusal offers a plan and names no tier, status or machinery", () => {
    expect(TOPUP_NEEDS_A_PLAN_SENTENCE).toMatch(/plan/i);
    for (const leak of ["free", "tier", "Stripe", "subscription", "status", "topup", "units"]) {
      expect(TOPUP_NEEDS_A_PLAN_SENTENCE.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });
});
