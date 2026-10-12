import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_TIERS } from "../../../../../drizzle/schema";
import { planCreditSliderSpec } from "../../../../../server/stripe/planCreditSlider";
import { formatCredits, displayBalance } from "../../../../../shared/creditDisplay";
import { planCreditSliderLedgerCredits } from "../../../../../shared/planCreditSlider";
import {
  creditStepsPriceAMonth,
  formatWholeDollars,
  priceAMonth,
} from "../planMath";

/*
  SETTINGS → BILLING PRICES THE PLAN THE WAY CHANGE PLAN DOES — card 2392.

  A Pro customer billed yearly read "$68.00/mo" on this card while Change plan
  priced the same plan at "$56 / month, billed yearly"; a customer on the dial's
  rung read the bottom of the dial for both price and credits. This drives the
  REAL component through React's renderer with `trpc` answered from a per-test
  table, and every expected figure is computed by the functions Change plan's
  own `priceOf` / `creditsWithSlider` use, over the real `PLAN_TIERS` and the
  real served slider spec — no price is typed here.
*/

let answers: Record<string, unknown> = {};

function procedure(path: string[]): unknown {
  return new Proxy(() => undefined, {
    get(_target, key: string) {
      if (key === "useQuery") {
        return (_input?: unknown, opts?: { enabled?: boolean }) => ({
          data: opts?.enabled === false ? undefined : answers[path.join(".")],
          isSuccess: path.join(".") in answers,
          isError: false,
        });
      }
      if (key === "useMutation") return () => ({ mutate: () => undefined, isPending: false });
      if (key === "invalidate") return () => Promise.resolve();
      return procedure([...path, key]);
    },
    apply() {
      return procedure(path);
    },
  });
}

vi.mock("@/lib/trpc", () => ({
  trpc: new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === "useUtils") return () => procedure([]);
        return procedure([key]);
      },
    },
  ),
}));

const { BillingSection, ownPlanTerms } = await import("./BillingSection");

const SPEC = planCreditSliderSpec();
const DIAL_TIER = SPEC.planId as keyof typeof PLAN_TIERS;
const RENEWS = new Date("2026-11-09T00:00:00Z");

function render(tier: keyof typeof PLAN_TIERS) {
  return renderToStaticMarkup(
    createElement(BillingSection, {
      planName: PLAN_TIERS[tier].name,
      planPriceInCents: PLAN_TIERS[tier].price,
      allowance: PLAN_TIERS[tier].monthlyCredits,
      balance: 1_000,
      renewsAt: RENEWS,
      onChangePlan: () => undefined,
      onAddCredits: () => undefined,
    }),
  );
}

function status(tier: string, billingInterval: "month" | "year" | null) {
  return { planTier: tier, billingInterval, stripeCustomerId: "cus_fixture", hasSubscription: true };
}

/* What Change plan prints on its card for this plan, at this interval and dial. */
function changePlanFigure(tier: keyof typeof PLAN_TIERS, annual: boolean, units = 0): string {
  return formatWholeDollars(
    priceAMonth(PLAN_TIERS[tier].price, annual) + creditStepsPriceAMonth(units, annual),
  );
}

const credits = (ledger: number) => `${formatCredits(displayBalance(ledger))} credits/mo`;

beforeEach(() => {
  answers = { "billing.getPlans": { creditSlider: SPEC } };
});

describe("a yearly subscriber is quoted the yearly rate, as Change plan quotes it", () => {
  it("the dev fixture: Pro billed yearly reads Change plan's figure, not the list price", () => {
    answers["billing.getStatus"] = status("pro", "year");
    const html = render("pro");
    const yearly = changePlanFigure("pro", true);
    expect(html).toContain(`${yearly}/mo, billed yearly`);
    /* The list price is the defect, in either format. */
    expect(html).not.toContain(changePlanFigure("pro", false));
    expect(html).not.toContain("$68.00");
    /* Sanity on the instrument: the two figures really differ. */
    expect(yearly).not.toBe(changePlanFigure("pro", false));
  });

  it("positive control: a monthly subscriber still reads the monthly price, and no yearly words", () => {
    answers["billing.getStatus"] = status("pro", "month");
    const html = render("pro");
    expect(html).toContain(`${changePlanFigure("pro", false)}/mo`);
    expect(html).not.toContain("billed yearly");
  });

  it("an interval nobody read is not monthly — the price stands down (#1763)", () => {
    answers["billing.getStatus"] = status("pro", null);
    const html = render("pro");
    expect(html).not.toContain(changePlanFigure("pro", false));
    expect(html).not.toContain(changePlanFigure("pro", true));
    expect(html).not.toContain("No charge");
  });
});

describe("the credit dial is in both the price and the credits", () => {
  it("is on a rung the ladder actually has", () => {
    expect(SPEC.maxUnits).toBeGreaterThan(0);
    expect(PLAN_TIERS[DIAL_TIER]).toBeDefined();
  });

  for (const interval of ["month", "year"] as const) {
    it(`a dial moved three steps is priced and credited (${interval})`, () => {
      answers["billing.getStatus"] = status(DIAL_TIER, interval);
      answers["billing.getPlanCreditUnits"] = { units: 3 };
      const html = render(DIAL_TIER);
      const annual = interval === "year";
      expect(html).toContain(`${changePlanFigure(DIAL_TIER, annual, 3)}/mo`);
      expect(html).toContain(
        credits(PLAN_TIERS[DIAL_TIER].monthlyCredits + planCreditSliderLedgerCredits(3)),
      );
      /* Not the base rung. */
      expect(html).not.toContain(`${changePlanFigure(DIAL_TIER, annual, 0)}/mo`);
      expect(html).not.toContain(credits(PLAN_TIERS[DIAL_TIER].monthlyCredits));
    });
  }

  it("positive control: the dial at rest reads the base rung", () => {
    answers["billing.getStatus"] = status(DIAL_TIER, "month");
    answers["billing.getPlanCreditUnits"] = { units: 0 };
    const html = render(DIAL_TIER);
    expect(html).toContain(`${changePlanFigure(DIAL_TIER, false)}/mo`);
    expect(html).toContain(credits(PLAN_TIERS[DIAL_TIER].monthlyCredits));
  });

  it("a dial position not read yet holds both figures rather than claiming the bottom", () => {
    answers["billing.getStatus"] = status(DIAL_TIER, "month");
    const html = render(DIAL_TIER);
    expect(html).not.toContain(`${changePlanFigure(DIAL_TIER, false)}/mo`);
    expect(html).not.toContain("credits/mo");
  });

  it("a position the server could not read (units: null) holds both too", () => {
    answers["billing.getStatus"] = status(DIAL_TIER, "month");
    answers["billing.getPlanCreditUnits"] = { units: null };
    const html = render(DIAL_TIER);
    expect(html).not.toContain("/mo");
  });

  it("a rung without the dial never waits on the dial's position", () => {
    answers["billing.getStatus"] = status("pro", "month");
    /* Even a stray answer is not read for a rung that has no dial. */
    answers["billing.getPlanCreditUnits"] = { units: 3 };
    const html = render("pro");
    expect(html).toContain(`${changePlanFigure("pro", false)}/mo`);
    expect(html).toContain(credits(PLAN_TIERS.pro.monthlyCredits));
  });

  it("an unread catalogue holds the paid figures (nobody knows which rung has the dial)", () => {
    answers = { "billing.getStatus": status("pro", "month") };
    const html = render("pro");
    expect(html).not.toContain("/mo");
  });
});

describe("ownPlanTerms — the rule, driven directly", () => {
  it("a free rung is No charge whatever else is unread", () => {
    expect(
      ownPlanTerms({ planPriceInCents: 0, allowance: 100, billingInterval: null, sliderUnits: null }).price,
    ).toBe("No charge");
  });

  it("an unread price is held", () => {
    expect(
      ownPlanTerms({ planPriceInCents: null, allowance: 100, billingInterval: "month", sliderUnits: 0 }).price,
    ).toBeNull();
  });
});
