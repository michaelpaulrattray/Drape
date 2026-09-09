/**
 * THE ANNUAL ARITHMETIC IS DECLARED ONCE, AND BOTH SIDES READ IT (#664).
 *
 * Until this change `monthly × 12 × 0.83` lived twice — inline in the server's
 * checkout builder and as `ANNUAL_RATE` in the client's `planMath.ts` — which
 * is working law 4's mirror on the number that charges the card. The sweep
 * arms below hold the two former declaration sites to READING the shared
 * module rather than declaring their own, so the drift cannot come back
 * silently. Comments are stripped before matching: both files legitimately
 * QUOTE the old shape while telling its story.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANNUAL_RATE,
  annualPriceInCents,
  monthsFreePerYear,
  periodPriceInCents,
  monthsBought,
  stripeIntervalOf,
  choiceOfStripeInterval,
} from "../shared/annualBilling";

const REPO = process.cwd();
const read = (...parts: string[]) => readFileSync(join(REPO, ...parts), "utf8");
/** Source with comments removed, so a story about the old code cannot match. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the arithmetic itself", () => {
  it("a year is 12 months at the rate, rounded once", () => {
    expect(annualPriceInCents(15_900)).toBe(Math.round(15_900 * 12 * ANNUAL_RATE));
    expect(annualPriceInCents(15_900)).toBeLessThan(15_900 * 12);
  });

  it("the badge derives from the rate — two months free at 0.83", () => {
    expect(monthsFreePerYear()).toBe(2);
  });

  it("a period's price is a month's or a year's, nothing else", () => {
    expect(periodPriceInCents(10_000, "monthly")).toBe(10_000);
    expect(periodPriceInCents(10_000, "annual")).toBe(annualPriceInCents(10_000));
  });

  it("a year buys twelve months of allowance; a month buys one", () => {
    expect(monthsBought("year")).toBe(12);
    expect(monthsBought("month")).toBe(1);
  });

  it("the two dialects convert exactly, and anything else answers null", () => {
    expect(stripeIntervalOf("annual")).toBe("year");
    expect(stripeIntervalOf("monthly")).toBe("month");
    expect(choiceOfStripeInterval("year")).toBe("annual");
    expect(choiceOfStripeInterval("month")).toBe("monthly");
    /* A week/day price is nothing this product sells — pretending it is
       monthly would misprice it, so the reader refuses to guess. */
    expect(choiceOfStripeInterval("week")).toBeNull();
    expect(choiceOfStripeInterval(undefined)).toBeNull();
    expect(choiceOfStripeInterval(null)).toBeNull();
  });
});

describe("one declaration — the mirror stays collapsed (working law 4)", () => {
  it("shared/annualBilling.ts is the only file that declares the rate", () => {
    const declaration = /ANNUAL_RATE\s*=\s*0?\.\d+/;
    expect(code(read("shared", "annualBilling.ts"))).toMatch(declaration);
    expect(
      code(read("client", "src", "features", "settings", "planMath.ts")),
      "planMath declares its own rate again — it must re-export the shared one",
    ).not.toMatch(declaration);
    expect(
      code(read("server", "stripe", "stripeService.ts")),
      "stripeService grew its own rate again",
    ).not.toMatch(declaration);
  });

  it("the server checkout builder computes through the shared module, not inline", () => {
    const service = code(read("server", "stripe", "stripeService.ts"));
    expect(service).toContain('from "@shared/annualBilling"');
    expect(service, "the inline 12 × 0.83 came back").not.toMatch(/\*\s*12\s*\*\s*0?\.83/);
    expect(service).toContain("periodPriceInCents(product.priceInCents, interval)");
  });

  it("planMath re-exports the shared arithmetic under the names its surfaces use", () => {
    const planMath = code(read("client", "src", "features", "settings", "planMath.ts"));
    expect(planMath).toContain("annualPriceInCents as annualPrice");
    expect(planMath).toContain("monthsFreePerYear as monthsFree");
    expect(planMath, "planMath computes the year inline again").not.toMatch(
      /\*\s*12\s*\*\s*ANNUAL_RATE/,
    );
  });
});
