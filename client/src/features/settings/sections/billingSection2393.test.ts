import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  SETTINGS → BILLING SAYS ONLY WHAT IS TRUE OF THIS ACCOUNT — two cards, one pane.

  Card 2393: a subscriber whose balance is above one month's grant (a rollover
  renewal writes outside-plan + grant + rollover, so Pro renews at 175% and Pro
  Plus at 200%; any top-up does the same) read "200% of this month's allowance
  left" beside a bar that clamps. The sentence now stands down over the grant.

  Card 2397: a free account was offered "Update card", and the portal refuses
  an account with no Stripe customer, so the press only ever produced an error
  toast. The payment card now shows only for an account that has one.

  This drives the REAL component through React's own renderer. `trpc` is
  replaced by a proxy that answers each query from a per-test table, so what is
  asserted is the markup the browser would get for that account — not a string
  in the source. (The card numbers are in this comment and not in a string: the
  foundation token guard reads a hash and hex digits in a string as a colour.)
*/

let answers: Record<string, unknown> = {};

function procedure(path: string[]): unknown {
  return new Proxy(() => undefined, {
    get(_target, key: string) {
      if (key === "useQuery") return () => ({
        data: answers[path.join(".")],
        isSuccess: path.join(".") in answers,
        isError: false,
      });
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

const { BillingSection } = await import("./BillingSection");

/* The dev fixture's own figures from the card: Pro, a 36,000-credit month,
   held in ledger units (five to a displayed credit). */
const PRO_ALLOWANCE = 180_000;
const RENEWS = new Date("2026-11-09T00:00:00Z");

function render(props: { balance: number | null; allowance?: number | null; renewsAt?: Date | null }) {
  return renderToStaticMarkup(
    createElement(BillingSection, {
      planName: "Pro",
      planPriceInCents: 2900,
      allowance: props.allowance === undefined ? PRO_ALLOWANCE : props.allowance,
      balance: props.balance,
      renewsAt: props.renewsAt === undefined ? RENEWS : props.renewsAt,
      onChangePlan: () => undefined,
      onAddCredits: () => undefined,
    }),
  );
}

const PRO_STATUS = { planTier: "pro", stripeCustomerId: "cus_fixture", hasSubscription: true };
const FREE_STATUS = { planTier: "free", hasSubscription: false };

beforeEach(() => {
  answers = {};
});

describe("the allowance sentence never claims more than the whole allowance", () => {
  beforeEach(() => {
    answers["billing.getStatus"] = PRO_STATUS;
  });

  it("positive control: under the grant it still says how much of the month is left", () => {
    const html = render({ balance: 90_000 });
    expect(html).toContain("50% of this month&#x27;s allowance left");
    expect(html).toContain(">more credits<");
  });

  it("exactly the grant is 100%, and still said", () => {
    expect(render({ balance: PRO_ALLOWANCE })).toContain("100% of this month&#x27;s allowance left");
  });

  it("a Pro Plus rollover renewal (200%) prints no percentage at all", () => {
    const html = render({ balance: 360_000 });
    expect(html).toContain("72,000");
    expect(html).not.toMatch(/\d+% of this month/);
    /* The link carries its own verb once nothing leads it. */
    expect(html).toContain(">Add more credits<");
    expect(html).not.toContain(">more credits<");
  });

  it("a Pro rollover (175%) and a small top-up over the grant (101%) stand down the same way", () => {
    for (const balance of [315_000, 181_800]) {
      expect(render({ balance }), `balance ${balance}`).not.toMatch(/\d+% of this month/);
    }
  });

  it("is not clamped into a different wrong sentence", () => {
    expect(render({ balance: 360_000 })).not.toContain("100% of this month");
  });

  it("an unread balance leaves no orphaned continuation link", () => {
    const html = render({ balance: null });
    expect(html).not.toMatch(/% of this month/);
    expect(html).toContain(">Add more credits<");
    expect(html).not.toContain(">more credits<");
  });
});

describe("only an account with a card on file is offered to update it", () => {
  it("positive control: a subscriber with a billing account sees Update card", () => {
    answers["billing.getStatus"] = PRO_STATUS;
    const html = render({ balance: 90_000 });
    expect(html).toContain("PAYMENT METHOD");
    expect(html).toContain("Update card");
  });

  it("a lapsed customer who still has a billing account keeps it", () => {
    answers["billing.getStatus"] = {
      planTier: "free",
      stripeCustomerId: "cus_fixture",
      hasSubscription: false,
      canManage: false,
    };
    expect(render({ balance: 0, allowance: 25_000, renewsAt: null })).toContain("Update card");
  });

  it("a free account with no billing account is not offered a button that only errors", () => {
    answers["billing.getStatus"] = FREE_STATUS;
    const html = render({ balance: 25_000, allowance: 25_000, renewsAt: null });
    expect(html).toContain("CREDITS REMAINING");
    expect(html).not.toContain("PAYMENT METHOD");
    expect(html).not.toContain("Update card");
    /* The road stays: Change plan on the plan card. */
    expect(html).toContain("Change plan");
  });

  it("a row with a null customer id is the same as none", () => {
    answers["billing.getStatus"] = { planTier: "free", stripeCustomerId: null, hasSubscription: false };
    expect(render({ balance: 25_000, allowance: 25_000, renewsAt: null })).not.toContain("Update card");
  });

  it("an unread status holds the control back rather than guessing", () => {
    expect(render({ balance: null })).not.toContain("Update card");
  });
});
