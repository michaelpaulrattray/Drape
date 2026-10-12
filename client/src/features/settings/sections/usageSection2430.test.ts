import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_TIERS } from "../../../../../drizzle/schema";
import { planCreditSliderSpec } from "../../../../../server/stripe/planCreditSlider";
import { displayBalance, formatCredits } from "../../../../../shared/creditDisplay";
import { planCreditSliderLedgerCredits } from "../../../../../shared/planCreditSlider";

/*
  THE USAGE PANE'S "of N this billing period" IS THE ALLOWANCE THE CUSTOMER
  PAYS FOR — card 2430, the sibling #2392's seat named on PR #2429.

  A customer on the credit dial's rung who had bought extra steps read the
  bottom of the dial as their period's allowance. This drives the REAL pane
  through React's renderer with `trpc` answered per test, and every expected
  figure is computed from the real `PLAN_TIERS`, the real served slider spec
  and `planCreditSliderLedgerCredits` — the function the renewal's grant reads.
*/

let answers: Record<string, unknown> = {};

function procedure(path: string[]): unknown {
  return new Proxy(() => undefined, {
    get(_target, key: string) {
      if (key === "useQuery") {
        return (_input?: unknown, opts?: { enabled?: boolean }) => ({
          data: opts?.enabled === false ? undefined : answers[path.join(".")],
        });
      }
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

const { UsageSection } = await import("./UsageSection");

const SPEC = planCreditSliderSpec();
const DIAL_TIER = SPEC.planId as keyof typeof PLAN_TIERS;

function render(tier: keyof typeof PLAN_TIERS) {
  return renderToStaticMarkup(
    createElement(UsageSection, {
      /* What `AccountSurfaces` hands down: the rung's LIST grant. */
      allowance: PLAN_TIERS[tier].monthlyCredits,
      balance: 1_000,
    }),
  );
}

const note = (ledger: number) => `of ${formatCredits(displayBalance(ledger))} this billing period`;

beforeEach(() => {
  answers = {
    "billing.getPlans": { creditSlider: SPEC },
    "usage.getCycleSpend": { spent: 2_000, days: 4, basis: "period" },
    "profile.storageInfo": { used: 0, limit: 0 },
  };
});

describe("the Usage pane quotes the dial's allowance, not the bottom of the dial", () => {
  it("is on a rung the ladder actually has", () => {
    expect(SPEC.maxUnits).toBeGreaterThan(0);
    expect(PLAN_TIERS[DIAL_TIER]).toBeDefined();
  });

  it("a dial moved three steps reads base + three steps", () => {
    answers["billing.getStatus"] = { planTier: DIAL_TIER };
    answers["billing.getPlanCreditUnits"] = { units: 3 };
    const html = render(DIAL_TIER);
    const base = PLAN_TIERS[DIAL_TIER].monthlyCredits;
    expect(html).toContain(note(base + planCreditSliderLedgerCredits(3)));
    /* The defect: the bottom of the dial. */
    expect(html).not.toContain(note(base));
    /* Sanity on the instrument: the two figures really differ. */
    expect(note(base + planCreditSliderLedgerCredits(3))).not.toBe(note(base));
  });

  it("positive control: the dial at rest reads the base grant", () => {
    answers["billing.getStatus"] = { planTier: DIAL_TIER };
    answers["billing.getPlanCreditUnits"] = { units: 0 };
    expect(render(DIAL_TIER)).toContain(note(PLAN_TIERS[DIAL_TIER].monthlyCredits));
  });

  it("a dial position not read yet quotes no allowance rather than the bottom", () => {
    answers["billing.getStatus"] = { planTier: DIAL_TIER };
    const html = render(DIAL_TIER);
    expect(html).not.toMatch(/of [\d,]+ this billing period/);
    /* The window words themselves are still true and still shown. */
    expect(html).toContain("Usage this billing period");
  });

  it("a position the server could not read (units: null) quotes none either", () => {
    answers["billing.getStatus"] = { planTier: DIAL_TIER };
    answers["billing.getPlanCreditUnits"] = { units: null };
    expect(render(DIAL_TIER)).not.toMatch(/of [\d,]+ this billing period/);
  });

  it("a rung without the dial never waits on, or reads, the dial's position", () => {
    answers["billing.getStatus"] = { planTier: "pro" };
    /* Even a stray answer is not read for a rung that has no dial. */
    answers["billing.getPlanCreditUnits"] = { units: 3 };
    const html = render("pro");
    expect(html).toContain(note(PLAN_TIERS.pro.monthlyCredits));
    expect(html).not.toContain(
      note(PLAN_TIERS.pro.monthlyCredits + planCreditSliderLedgerCredits(3)),
    );
  });

  it("an unread status or catalogue quotes no allowance (nobody knows which rung has the dial)", () => {
    answers["billing.getPlanCreditUnits"] = { units: 3 };
    expect(render(DIAL_TIER)).not.toMatch(/of [\d,]+ this billing period/);
    answers["billing.getStatus"] = { planTier: DIAL_TIER };
    delete answers["billing.getPlans"];
    expect(render(DIAL_TIER)).not.toMatch(/of [\d,]+ this billing period/);
  });
});
