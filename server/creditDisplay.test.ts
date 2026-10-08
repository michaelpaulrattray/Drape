/**
 * THE DISPLAY HELPER'S PROPERTIES — #1600 done-when 2, driven rather than
 * asserted on examples.
 *
 * Three arms carry the safety of the whole scale change and the third is the
 * one that matters:
 *
 * 1. **A balance is never overstated** — `displayBalance(b) × 5 ≤ b`.
 * 2. **A price is never understated** — `displayPrice(p) × 5 ≥ p`.
 * 3. **⚠ THE AFFORDABILITY PROPERTY.** A customer whose SHOWN balance is at
 *    least the SHOWN price can complete the action — their real balance
 *    covers the real charge. This is the defect a pricing display can produce
 *    that nothing else catches: round a balance up or a price down and the
 *    product waves somebody into a server refusal, with the screen insisting
 *    they could afford it. It follows from 1 and 2, and it is driven anyway
 *    over every pair in a real range, because "it follows" is a claim.
 *
 * The ranges are exhaustive where exhaustive is cheap and randomised above
 * that with a FIXED seed, so a failure is reproducible rather than a story
 * about a CI run nobody can repeat.
 */
import { describe, expect, it } from "vitest";

import {
  DisplayCredits,
  LEDGER_PER_DISPLAY_CREDIT,
  MILLIONS_STYLE_FROM,
  displayBalance,
  displayMovement,
  displayPrice,
  displayRefund,
  displaySpent,
  formatCredits,
  ledgerForDisplay,
  staffCreditFact,
  wholeDisplayLedger,
} from "../shared/creditDisplay";

/** A reproducible generator — a seeded LCG, so a red is re-runnable. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const EXHAUSTIVE_TO = 5_000;
const RANDOM_SAMPLES = 20_000;
/** Ultimate's monthly grant — the largest ledger number the product declares. */
const RANDOM_CEILING = 300_000_000;

function exhaustive(): number[] {
  return Array.from({ length: EXHAUSTIVE_TO + 1 }, (_, n) => n);
}

function randomLedgers(seed: number): number[] {
  const next = seeded(seed);
  return Array.from({ length: RANDOM_SAMPLES }, () => Math.floor(next() * RANDOM_CEILING));
}

describe("the scale is declared once", () => {
  it("is 5 ledger credits to the displayed credit", () => {
    expect(LEDGER_PER_DISPLAY_CREDIT).toBe(5);
  });

  it("divides the approved prices to the approved display figures", () => {
    /* #1598's own table, which is what a customer is promised. If the scale or
       the rounding ever moves, these are the numbers that must be re-approved. */
    expect(displayPrice(1_200)).toBe(240); // Roll
    expect(displayPrice(1_600)).toBe(320); // Follow
    expect(displayPrice(8_500)).toBe(1_700); // Sign
    expect(displayPrice(1_750)).toBe(350); // Refine and paid Try again
  });

  it("divides the approved refund slices to whole displayed credits", () => {
    expect(displayRefund(150)).toBe(30); // one Roll candidate
    expect(displayRefund(200)).toBe(40); // one Follow candidate
    expect(displayRefund(1_000)).toBe(200); // one failed Sign view
    expect(displayRefund(8_500)).toBe(1_700); // a Sign lost entirely
  });

  it("reads the card's worked example — a balance of 18,440 shows as 3,688", () => {
    expect(displayBalance(18_440)).toBe(3_688);
  });
});

describe("property 1 — a balance is never overstated", () => {
  it("holds for every ledger value from 0 to 5,000", () => {
    const broken = exhaustive().filter((b) => displayBalance(b) * LEDGER_PER_DISPLAY_CREDIT > b);
    expect(broken).toEqual([]);
  });

  it("holds over 20,000 sampled values up to the largest grant the product declares", () => {
    const broken = randomLedgers(0x5eed_1).filter(
      (b) => displayBalance(b) * LEDGER_PER_DISPLAY_CREDIT > b,
    );
    expect(broken).toEqual([]);
  });

  it("holds for a refund too, which lands on a balance", () => {
    const broken = exhaustive().filter((r) => displayRefund(r) * LEDGER_PER_DISPLAY_CREDIT > r);
    expect(broken).toEqual([]);
  });
});

describe("property 2 — a price is never understated", () => {
  it("holds for every ledger value from 0 to 5,000", () => {
    const broken = exhaustive().filter((p) => displayPrice(p) * LEDGER_PER_DISPLAY_CREDIT < p);
    expect(broken).toEqual([]);
  });

  it("holds over 20,000 sampled values up to the largest grant the product declares", () => {
    const broken = randomLedgers(0x5eed_2).filter(
      (p) => displayPrice(p) * LEDGER_PER_DISPLAY_CREDIT < p,
    );
    expect(broken).toEqual([]);
  });
});

describe("property 3 — the affordability property: a shown balance that covers the shown price really does cover the charge", () => {
  it("holds for every balance and price pair from 0 to 400", () => {
    const wave: { balance: number; price: number }[] = [];
    for (let balance = 0; balance <= 400; balance += 1) {
      for (let price = 0; price <= 400; price += 1) {
        if (displayBalance(balance) >= displayPrice(price) && balance < price) {
          wave.push({ balance, price });
        }
      }
    }
    expect(wave).toEqual([]);
  });

  it("holds over 20,000 sampled pairs clustered on the real prices", () => {
    const next = seeded(0x5eed_3);
    const prices = [1_200, 1_600, 8_500, 1_750, 150, 200, 1_000, 3_500];
    const wave: { balance: number; price: number }[] = [];
    for (let n = 0; n < RANDOM_SAMPLES; n += 1) {
      const price = prices[n % prices.length];
      /* Balances clustered around the price, which is where the boundary is. */
      const balance = Math.max(0, price + Math.floor(next() * 21) - 10);
      if (displayBalance(balance) >= displayPrice(price) && balance < price) {
        wave.push({ balance, price });
      }
    }
    expect(wave).toEqual([]);
  });

  it("is a real boundary and not a vacuous one — the arms above can reach the case they are about", () => {
    /* Law 2: the arms above pass trivially if a shown balance never reaches a
       shown price. Prove the interesting state is reachable. */
    expect(displayBalance(1_200)).toBe(240);
    expect(displayPrice(1_200)).toBe(240);
    expect(displayBalance(1_200) >= displayPrice(1_200)).toBe(true);
    /* And one ledger credit short must NOT read as affordable. */
    expect(displayBalance(1_199) >= displayPrice(1_200)).toBe(false);
  });

  it("catches the rounding that would break it — a floored price waves a customer into a refusal", () => {
    /* The positive control for this whole group: the wrong rounding, driven.
       ⚠ THE PRICE HERE MUST NOT BE A MULTIPLE OF 5, and the first draft of this
       arm used 1,200 and passed for the wrong reason. At an exact multiple
       floor and ceil AGREE, so the defect cannot appear there — the control was
       green while proving nothing (law 2, caught by running it).

       That is not a quirk of the fixture, it is the shape of the risk: #1601
       makes every approved price a multiple of 5, so the asymmetry is dormant
       on the price table and live on everything derived from it — the
       flashMultiplier halves, a per-candidate slice of an odd total, any future
       price that misses the grid. This arm is the reason `displayPrice` may
       never be relaxed to a floor just because "the prices all divide". */
    const flooredPrice = (ledger: number) => Math.floor(ledger / LEDGER_PER_DISPLAY_CREDIT);
    expect(1_201 % LEDGER_PER_DISPLAY_CREDIT).not.toBe(0);
    expect(displayBalance(1_200) >= flooredPrice(1_201)).toBe(true);
    expect(1_200 < 1_201).toBe(true);
    /* And the shipped helper refuses that same pair. */
    expect(displayBalance(1_200) >= displayPrice(1_201)).toBe(false);
  });
});

describe("a refund and a balance round the same way, and are held equal rather than aliased", () => {
  it("agrees on every value from 0 to 5,000", () => {
    const disagreeing = exhaustive().filter((n) => displayRefund(n) !== displayBalance(n));
    expect(disagreeing).toEqual([]);
  });
});

describe("the fractional ledger value the product really has", () => {
  it("rounds a flash-multiplied price up rather than refusing it", () => {
    /* CREDIT_COSTS.flashMultiplier is 0.5, so a half-price cost is a real
       ledger value. 175 / 5 = 35 exactly; 177 / 5 must not read as 35. */
    expect(displayPrice(350 * 0.5)).toBe(35);
    expect(displayPrice(177)).toBe(36);
    expect(displayBalance(177)).toBe(35);
  });
});

describe("an X-of-Y-spent pair adds up on the screen", () => {
  it("never shows a spent and a remaining that miss their total", () => {
    const next = seeded(0x5eed_4);
    const broken: { spent: number; remaining: number }[] = [];
    for (let n = 0; n < RANDOM_SAMPLES; n += 1) {
      const spent = Math.floor(next() * 100_000);
      const remaining = Math.floor(next() * 100_000);
      const shownSpent = displaySpent(spent, remaining);
      const shownRemaining = displayBalance(remaining);
      const shownTotal = displayBalance(spent + remaining);
      if (shownSpent + shownRemaining !== shownTotal) broken.push({ spent, remaining });
    }
    expect(broken).toEqual([]);
  });

  it("catches the naive pairing this exists to prevent", () => {
    /* Positive control: three independent floors really can miss by one. */
    const naive = (spent: number, remaining: number) =>
      Math.floor(spent / 5) + Math.floor(remaining / 5) === Math.floor((spent + remaining) / 5);
    expect(naive(3, 4)).toBe(false);
    expect(displaySpent(3, 4) + displayBalance(4) === displayBalance(7)).toBe(true);
  });
});

describe("a number that cannot be shown is refused rather than rendered", () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    it(`refuses ${String(bad)} in every entrance, naming the caller`, () => {
      expect(() => displayBalance(bad)).toThrow(/displayBalance/);
      expect(() => displayPrice(bad)).toThrow(/displayPrice/);
      expect(() => displayRefund(bad)).toThrow(/displayRefund/);
      expect(() => displaySpent(bad, 0)).toThrow(/displaySpent/);
      expect(() => formatCredits(bad as DisplayCredits)).toThrow(/formatCredits/);
    });
  }

  it("says what it got, so the upstream defect is findable", () => {
    expect(() => displayPrice(Number.NaN)).toThrow(/NaN/);
  });
});

describe("wholeDisplayLedger — a grant with no invisible credit in it (#1604 slice 2)", () => {
  it("leaves nothing a customer cannot be shown: the quantised amount divides exactly", () => {
    const leaky = exhaustive().filter(
      (ledger) => wholeDisplayLedger(ledger) % LEDGER_PER_DISPLAY_CREDIT !== 0,
    );
    expect(leaky).toEqual([]);
  });

  it("holds over 20,000 sampled values up to the largest grant the product declares", () => {
    const leaky = randomLedgers(0x5eed_4).filter(
      (ledger) => wholeDisplayLedger(ledger) % LEDGER_PER_DISPLAY_CREDIT !== 0,
    );
    expect(leaky).toEqual([]);
  });

  it("⚠ AGREES WITH THE SCREEN — the quantised grant shows exactly what displayBalance would say", () => {
    /* The whole point. If these two ever disagree, a balance built from this
       grant cannot be made to add up on any screen. */
    const disagreeing = exhaustive().filter(
      (ledger) => wholeDisplayLedger(ledger) / LEDGER_PER_DISPLAY_CREDIT !== displayBalance(ledger),
    );
    expect(disagreeing).toEqual([]);
  });

  it("never hands out MORE than was computed — a grant only ever rounds down", () => {
    const generous = exhaustive().filter((ledger) => wholeDisplayLedger(ledger) > ledger);
    expect(generous).toEqual([]);
  });

  it("never takes MORE than was computed — a deduction only ever shrinks", () => {
    /* The negative half, which is where Math.floor would have been wrong: the
       magnitude must not grow, or a downgrade deducts more than the upgrade
       that earned it granted (#664's credit-minting loop, the other way). */
    const harsher = exhaustive().filter((ledger) => Math.abs(wholeDisplayLedger(-ledger)) > ledger);
    expect(harsher).toEqual([]);
  });

  it("truncates toward zero, which is NOT what Math.floor does on the negative half", () => {
    /* A real divergence, named with numbers so the choice is legible: the
       arm below is the one that fails if someone "simplifies" this to a floor. */
    expect(wholeDisplayLedger(-3_666)).toBe(-3_665);
    expect(Math.floor(-3_666 / LEDGER_PER_DISPLAY_CREDIT) * LEDGER_PER_DISPLAY_CREDIT).toBe(-3_670);
    expect(wholeDisplayLedger(-3_666)).toBeGreaterThan(
      Math.floor(-3_666 / LEDGER_PER_DISPLAY_CREDIT) * LEDGER_PER_DISPLAY_CREDIT,
    );
  });

  it("is symmetric about zero, so an upgrade and its mirror downgrade settle equally", () => {
    const asymmetric = exhaustive().filter(
      (ledger) => wholeDisplayLedger(-ledger) !== -wholeDisplayLedger(ledger),
    );
    expect(asymmetric).toEqual([]);
  });

  it("leaves an amount that is already whole exactly alone", () => {
    for (const whole of [0, 5, 100, 1_200, 8_500, 75_000, 300_000_000]) {
      expect(wholeDisplayLedger(whole)).toBe(whole);
    }
  });

  it("is a real boundary and not a vacuous one — the arms above reach values it actually moves", () => {
    /* A quantiser that never changed anything would pass every arm above. */
    const moved = exhaustive().filter((ledger) => wholeDisplayLedger(ledger) !== ledger);
    expect(moved.length).toBeGreaterThan(EXHAUSTIVE_TO / 2);
    expect(wholeDisplayLedger(7_333)).toBe(7_330);
  });

  it("refuses a number that cannot be quantised, naming itself", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => wholeDisplayLedger(bad)).toThrow(/wholeDisplayLedger/);
    }
  });
});

describe("formatCredits — what the customer actually reads", () => {
  it("groups an ordinary figure", () => {
    expect(formatCredits(displayBalance(18_440))).toBe((3_688).toLocaleString());
    expect(formatCredits(displayPrice(1_200))).toBe("240");
  });

  it("reads the plan grants in millions from Scale up, and not below it", () => {
    /* The threshold is calibrated on the real table: Business 3,000,000 ledger
       = 600,000 display (grouped), Scale 20,000,000 = 4,000,000 (M-style). */
    expect(formatCredits(displayBalance(3_000_000))).toBe((600_000).toLocaleString());
    expect(formatCredits(displayBalance(20_000_000))).toBe("4M");
    expect(formatCredits(displayBalance(75_000_000))).toBe("15M");
    expect(formatCredits(displayBalance(300_000_000))).toBe("60M");
  });

  it("drops a trailing zero decimal and keeps a meaningful one", () => {
    expect(formatCredits(1_000_000 as DisplayCredits)).toBe("1M");
    expect(formatCredits(1_500_000 as DisplayCredits)).toBe("1.5M");
  });

  it("switches exactly at the declared threshold and not a credit earlier", () => {
    expect(formatCredits((MILLIONS_STYLE_FROM - 1) as DisplayCredits)).toBe(
      (999_999).toLocaleString(),
    );
    expect(formatCredits(MILLIONS_STYLE_FROM)).toBe("1M");
  });
});

describe("ledgerForDisplay — a typed display figure becomes exactly that on screen (#1986)", () => {
  it("round-trips: what is typed is what the balance reads, for every whole figure in range, both signs", () => {
    const broken = exhaustive().filter(
      (display) =>
        displayBalance(ledgerForDisplay(display)) !== display ||
        ledgerForDisplay(-display) !== -ledgerForDisplay(display),
    );
    expect(broken).toEqual([]);
  });

  it("the founder's own figure: 100,000 typed moves 500,000 ledger, which reads 100,000", () => {
    expect(ledgerForDisplay(100_000)).toBe(500_000);
    expect(displayBalance(ledgerForDisplay(100_000))).toBe(100_000);
    expect(ledgerForDisplay(-20)).toBe(-100);
  });

  it("refuses a figure it would have to round, rather than moving a different amount", () => {
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(() => ledgerForDisplay(bad)).toThrow(TypeError);
    }
  });
});

describe("displayMovement — one row of a credit history on the customer's scale (#2010)", () => {
  it("a grant rounds down like a balance, a charge's size rounds up like a price, zero is zero", () => {
    expect(displayMovement(1_600)).toBe(320);
    expect(displayMovement(-1_600)).toBe(-320);
    expect(displayMovement(7)).toBe(1);
    expect(displayMovement(-7)).toBe(-2);
    expect(Object.is(displayMovement(0), 0)).toBe(true);
  });

  it("agrees with the two functions it delegates to, for every ledger value from 0 to 5,000, both signs", () => {
    const broken = exhaustive().filter(
      (n) => displayMovement(n) !== displayBalance(n) || displayMovement(-n) !== (n === 0 ? 0 : -displayPrice(n)),
    );
    expect(broken).toEqual([]);
  });

  it("refuses a non-finite figure rather than printing NaN in a ledger", () => {
    expect(() => displayMovement(Number.NaN)).toThrow(TypeError);
  });
});

describe("staffCreditFact — the customer's figure first, the ledger beside it (#2010)", () => {
  it("writes both numbers, grouped, the display one leading", () => {
    expect(staffCreditFact(displayBalance(500_000), 500_000)).toBe(
      `${(100_000).toLocaleString()} credits · ${(500_000).toLocaleString()} ledger`,
    );
  });

  it("keeps the caller's rounding: a deduction of 7 ledger reads as 2, a grant of 7 as 1", () => {
    expect(staffCreditFact(displayPrice(7), 7)).toBe("2 credits · 7 ledger");
    expect(staffCreditFact(displayBalance(7), 7)).toBe("1 credits · 7 ledger");
  });
});
