import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PLAN_TIERS } from "../../../../drizzle/schema";
import { OFFERED_PLAN_ORDER } from "../../../../server/stripe/stripeProducts";
import { CASTING_V2_ONE_CHARACTER_CREDITS } from "../../../../server/castingV2/castViewPackage";
import { LEDGER_PER_DISPLAY_CREDIT, displayBalance } from "../../../../shared/creditDisplay";
import { TOPUP_UNIT_DISPLAY_CREDITS, topupPriceInCents, TOPUP_MAX_UNITS } from "../../../../shared/creditTopups";
import { ANNUAL_RATE } from "../../../../shared/annualBilling";

/**
 * CARD #1774 — THE PRICING PHASE 2 PROTOTYPE CANNOT DRIFT FROM THE TREE.
 *
 * `docs/specs/pricing-phase2-plans/prototype.html` draws the plan surface he is
 * being asked to judge, and it draws it from a `FROM_THE_CODE` block of
 * constants it declares itself — because a standalone HTML file cannot import
 * TypeScript. **That block is a COPY, and a copy is not a derivation** (working
 * law 4, and the measured version of it: a correct derived reader inherits its
 * mirrored source's blind spot). So this suite reads the block back out of the
 * file and holds it against the real declarations.
 *
 * ⚠ **WHY A DOC GETS A GUARD AT ALL, which is a fair thing to ask.** The thing
 * on the other end of this file is **his eye** — law 9 closes #1774, and the
 * frames beside the prototype are what he looks at. A price moves in this
 * repository roughly every other week (#1598 → #1601 → #1602 → #1606 → #1699 →
 * #1702 in the last three days alone), and a design he approved against stale
 * numbers is worse than no design: the build cards cut from it would carry the
 * stale figure forward with his approval attached to it. This suite is what
 * makes a price change in the tree a RED rather than a quietly wrong picture.
 *
 * ## The two halves, and only the first is about constants
 *
 * **Half one** holds the copied constants equal to the real ones. **Half two**
 * holds the brief's §5 PROPOSAL — the slider's $9 a step — to the three
 * properties the brief argues it from, driven over `PLAN_TIERS` itself rather
 * than over the numbers the brief happens to print. The value is not pinned,
 * because it is his to choose; what is pinned is that whatever value the
 * prototype carries still satisfies the argument that was made for it. If he
 * picks $8, the arm that fails is the one that SHOULD fail — the slider would
 * then be better value than the sales conversation it hands off to.
 */

const PROTOTYPE = join(
  __dirname,
  "../../../../docs/specs/pricing-phase2-plans/prototype.html",
);

function prototypeSource(): string {
  const source = readFileSync(PROTOTYPE, "utf8");
  /* A pointer to a file that has moved must FAIL rather than pass vacuously —
     every `expect` below would otherwise find nothing and assert nothing. */
  expect(source.length).toBeGreaterThan(1000);
  return source;
}

/**
 * The `FROM_THE_CODE` object, read as text.
 *
 * ⚠ **SLICED, NOT GREPPED OVER THE WHOLE FILE.** The prototype restates several
 * of these names in its prose header and in its own arithmetic, so a
 * `toContain` over the whole document passes on a comment — the
 * guard-arm-satisfied-by-a-sibling shape this repository has paid for. The
 * slice is anchored on the declaration and ends at the line that closes it.
 */
function fromTheCodeBlock(): string {
  const source = prototypeSource();
  const start = source.indexOf("const FROM_THE_CODE = {");
  expect(start, "FROM_THE_CODE is not declared in the prototype").toBeGreaterThan(-1);
  const end = source.indexOf("\n};", start);
  expect(end, "FROM_THE_CODE is not closed").toBeGreaterThan(start);
  const block = source.slice(start, end);
  /* The anchor must be unique, or the slice is of whichever copy sorted first. */
  expect(source.split("const FROM_THE_CODE = {")).toHaveLength(2);
  return block;
}

/** `starter: { name: "Starter", credits: 70000, priceInCents: 2700, rolloverPercent: 50 }` */
function tierRow(block: string, tier: string): {
  name: string;
  credits: number;
  priceInCents: number;
  rolloverPercent: number;
} | null {
  const match = new RegExp(
    `\\b${tier}:\\s*\\{\\s*name:\\s*"([^"]+)",\\s*credits:\\s*(\\d+),\\s*priceInCents:\\s*(\\d+),\\s*rolloverPercent:\\s*(\\d+)\\s*\\}`,
  ).exec(block);
  if (match === null) return null;
  return {
    name: match[1],
    credits: Number(match[2]),
    priceInCents: Number(match[3]),
    rolloverPercent: Number(match[4]),
  };
}

function numberNamed(block: string, key: string): number | null {
  const match = new RegExp(`\\b${key}:\\s*([\\d_.]+)`).exec(block);
  return match === null ? null : Number(match[1].replace(/_/g, ""));
}

describe("Card 1774 — the Phase 2 prototype's figures are the product's figures", () => {
  it("carries every OFFERED rung, with the tree's own name, price, allowance and rollover", () => {
    const block = fromTheCodeBlock();
    for (const tier of OFFERED_PLAN_ORDER) {
      const row = tierRow(block, tier);
      expect(row, `the prototype has no row for the offered rung ${tier}`).not.toBeNull();
      expect(row).toEqual({
        name: PLAN_TIERS[tier].name,
        credits: PLAN_TIERS[tier].monthlyCredits,
        priceInCents: PLAN_TIERS[tier].price,
        rolloverPercent: PLAN_TIERS[tier].rolloverPercent,
      });
    }
  });

  it("carries no rung the product does not offer — the hidden one included", () => {
    const block = fromTheCodeBlock();
    for (const tier of Object.keys(PLAN_TIERS)) {
      if ((OFFERED_PLAN_ORDER as string[]).includes(tier)) continue;
      expect(
        tierRow(block, tier),
        `${tier} is not an offered rung and must not be drawn in a customer prototype`,
      ).toBeNull();
    }
  });

  it("carries the display scale, the character cost, the slider's unit and the annual rate", () => {
    const block = fromTheCodeBlock();
    expect(numberNamed(block, "ledgerPerDisplayCredit")).toBe(LEDGER_PER_DISPLAY_CREDIT);
    expect(numberNamed(block, "oneFinishedCharacterCredits")).toBe(CASTING_V2_ONE_CHARACTER_CREDITS);
    expect(numberNamed(block, "sliderStepDisplayCredits")).toBe(TOPUP_UNIT_DISPLAY_CREDITS);
    expect(numberNamed(block, "annualRate")).toBe(ANNUAL_RATE);
  });

  /*
    THE NEGATIVE CONTROL, and it is the arm that makes the three above mean
    anything (working law 2). Every assertion here reads a REGEX over text, and
    a regex that stops matching reports "the prototype has no row for …" — which
    is indistinguishable from a prototype that genuinely dropped the row. So one
    arm proves the reader can still SEE a wrong value rather than merely miss it.
  */
  it("the reader can tell a WRONG figure from an absent one", () => {
    const block = fromTheCodeBlock();
    const sabotaged = block.replace(
      `credits: ${PLAN_TIERS.pro.monthlyCredits},`,
      "credits: 1,",
    );
    expect(sabotaged, "the sabotage did not change the block").not.toBe(block);
    const row = tierRow(sabotaged, "pro");
    expect(row).not.toBeNull();
    expect(row?.credits).toBe(1);
    expect(row?.credits).not.toBe(PLAN_TIERS.pro.monthlyCredits);
  });
});

describe("Card 1774 §5 — the credit slider's proposed price still holds its own argument", () => {
  /** The three numbers the prototype's slider ladder is built from. */
  function sliderLadder(): { baseDisplay: number; baseDollars: number; perUnit: number; maxUnits: number } {
    const source = prototypeSource();
    const perUnit = /const SLIDER_DOLLARS_PER_UNIT = ([\d.]+);/.exec(source);
    expect(perUnit, "SLIDER_DOLLARS_PER_UNIT is not declared").not.toBeNull();
    /* The base and the ceiling are DERIVED in the prototype rather than typed,
       so they are recomputed here from the tree the same way it computes them —
       deriving them here from the real constants is the point, not a shortcut. */
    const baseDisplay = displayBalance(PLAN_TIERS.studio.monthlyCredits);
    const topDisplay = displayBalance(PLAN_TIERS.business.monthlyCredits);
    return {
      baseDisplay,
      baseDollars: PLAN_TIERS.studio.price / 100,
      perUnit: Number(perUnit![1]),
      maxUnits: Math.floor((topDisplay - baseDisplay) / TOPUP_UNIT_DISPLAY_CREDITS),
    };
  }

  const creditsPerDollar = (displayCredits: number, dollars: number) => displayCredits / dollars;

  it("credits per dollar RISES along the whole slider — the ladder's own invariant", () => {
    const { baseDisplay, baseDollars, perUnit, maxUnits } = sliderLadder();
    let previous = -Infinity;
    for (let units = 0; units <= maxUnits; units += 1) {
      const rate = creditsPerDollar(
        baseDisplay + units * TOPUP_UNIT_DISPLAY_CREDITS,
        baseDollars + units * perUnit,
      );
      expect(rate, `the rate fell at ${units} steps`).toBeGreaterThan(previous);
      previous = rate;
    }
  });

  it("never reaches the rate a sales conversation is for", () => {
    const { baseDisplay, baseDollars, perUnit, maxUnits } = sliderLadder();
    /* The hand-sold rungs above the slider — whatever they are — must stay
       better value than anything a customer can dial up alone, or "talk to us
       for more" is a sentence with nothing behind it. */
    const bestHandSold = Math.max(
      ...Object.values(PLAN_TIERS)
        .filter((t) => t.price > PLAN_TIERS.business.price)
        .map((t) => creditsPerDollar(displayBalance(t.monthlyCredits), t.price / 100)),
    );
    const atTheTop = creditsPerDollar(
      baseDisplay + maxUnits * TOPUP_UNIT_DISPLAY_CREDITS,
      baseDollars + maxUnits * perUnit,
    );
    expect(atTheTop).toBeLessThan(bestHandSold);
  });

  it("always beats a credit pack, so Add credits' plan nudge stays true", () => {
    const { baseDisplay, baseDollars, perUnit } = sliderLadder();
    const bestPackRate = creditsPerDollar(
      TOPUP_MAX_UNITS * TOPUP_UNIT_DISPLAY_CREDITS,
      topupPriceInCents(TOPUP_MAX_UNITS) / 100,
    );
    /* Step 0 is the worst the slider ever is — the rate only rises. */
    expect(creditsPerDollar(baseDisplay, baseDollars)).toBeGreaterThan(bestPackRate);
  });
});
