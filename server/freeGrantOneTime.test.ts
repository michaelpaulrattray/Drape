/**
 * THE FREE GRANT IS ONE NUMBER, GRANTED ONCE (#1602, P1-3 under the pricing
 * rung #1598).
 *
 * Two properties, and neither was driven before this suite:
 *
 * **1 · ONE PLACE.** `FREE_SIGNUP_GRANT_CREDITS` is the only place the figure
 * lives. It used to be three literal `5000`s — `PLAN_TIERS.free.monthlyCredits`,
 * `INITIAL_CREDITS` in `server/db/credits.ts`, and the `points.balance` column
 * default — so the product promise could be half-changed by anyone editing one
 * of them. Working law 4: a second list shadowing a source of truth always
 * drifts from it.
 *
 * **2 · ONCE, NOT MONTHLY.** The card's done-when says *"the free plan never
 * refreshes monthly"*, and the honest finding is that this was ALREADY TRUE and
 * had no test. `refreshMonthlyCredits` is reachable from exactly one road — the
 * `invoice.payment_succeeded` webhook — and that road returns early on the free
 * tier (`server/stripe/webhooks.ts:848`). A property that holds by accident and
 * a property that holds by design look identical until somebody moves the line,
 * which is invariant 7's shape pointed at a *behaviour* rather than a control.
 *
 * # Why the refresh arms drive the real entry point
 *
 * Working law 3: a backstop whose only test asserts a constant near the code is
 * untested. These arms deliver a real `invoice.payment_succeeded` event through
 * the exported `handleStripeWebhook` and watch whether `refreshMonthlyCredits`
 * is called at all — and the POSITIVE control is the arm that matters: the same
 * invoice, same everything, on a `pro` row DOES refresh. Without it, a suite
 * whose mocks had silently stopped reaching the handler would pass by never
 * getting there, which is the "surviving sabotage may be inert" failure.
 *
 * # What this suite deliberately does NOT assert
 *
 * It does not claim the DATABASE's stored default is 13,500. It is not: a
 * `MODIFY … SET DEFAULT` is refused by name and — worse — names no missing
 * object, so `scripts/lib/ceremonyAutoApply.mts` would neither apply nor refuse
 * a migration carrying it (`:208-216`, `:289-294`, `MissingObjects` at
 * `:108-112`). The reconciliation is the go-live ceremony
 * `scripts/raise-free-grant-1602.mts`. What this suite proves instead is that the
 * divergence cannot be READ: the sole INSERT into the table names `balance`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { join } from "node:path";
import type Stripe from "stripe";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

/* Two arms below read `server/db/credits.ts` off the real tree, which puts this
   suite in #741's derived population: green alone, red under load on somebody
   else's machine. Declared at file level because that is where the guard reads
   it, and the whole file is cheap either way. */
vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

import { readListedSource } from "./testing/listedSource";

vi.mock("./db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    /* The webhook's idempotency claim and its release (#1361); unrecorded here. */
    insert: () => ({ values: async () => undefined }),
    delete: () => ({ where: async () => undefined }),
  })),
}));

const { refreshMonthlyCredits, planTierOfRow } = vi.hoisted(() => ({
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 1 }),
  /* The tier the fake customer row reports, set per arm. */
  planTierOfRow: { current: "free" as string },
}));

vi.mock("./db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue({ success: true }),
  getUserByStripeCustomerId: vi.fn().mockImplementation(async () => ({
    id: 7,
    name: "free account",
    email: "seven@example.com",
    credits: { planTier: planTierOfRow.current, balance: 4_000 },
  })),
  refreshMonthlyCredits,
  getUserCredits: vi.fn().mockResolvedValue({ balance: 4_000, purchasedBalance: 0, rolloverCredits: 0 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(false),
  recordPlanChangeSettlement: vi.fn().mockResolvedValue({ success: true }),
  getPlanChangeSettlementByInvoice: vi.fn().mockResolvedValue(null),
  resolvePlanChangeSettlement: vi.fn().mockResolvedValue(true),
}));

vi.mock("./stripe/stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(0),
  getMonthlyCredits: vi.fn().mockReturnValue(190_000),
  cancelSubscription: vi.fn().mockResolvedValue(true),
}));

import { credits, FREE_SIGNUP_GRANT_CREDITS, PLAN_TIERS } from "../drizzle/schema";
import { handleStripeWebhook } from "./stripe/webhooks";
import { constructWebhookEvent } from "./stripe/stripeService";

const REPO_ROOT = join(__dirname, "..");

let eventSeq = 0;

/** A clover-shaped recurring month, which is what the registered endpoint sends. */
const DAY_S = 86_400;
const T = 1_788_900_000;
const monthInvoice = () => ({
  id: `in_free_grant_${eventSeq}`,
  customer: "cus_free_grant",
  subscription: "sub_free_grant",
  billing_reason: "subscription_cycle",
  lines: {
    data: [
      {
        parent: {
          type: "subscription_item_details",
          subscription_item_details: { proration: false },
        },
        pricing: { price_details: { price: "price_x" } },
        period: { start: T, end: T + 30 * DAY_S },
      },
    ],
  },
});

function deliver(planTier: string) {
  eventSeq += 1;
  planTierOfRow.current = planTier;
  vi.mocked(constructWebhookEvent).mockReturnValue({
    id: `evt_free_grant_${eventSeq}`,
    type: "invoice.payment_succeeded",
    data: { object: monthInvoice() },
    object: "event",
    api_version: "2026-01-28.clover",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event);
  return handleStripeWebhook("payload", "sig");
}

beforeEach(() => {
  refreshMonthlyCredits.mockClear();
});

describe("#1602 · the free signup grant lives in exactly one place", () => {
  it("is 13,500 ledger — the agreed number, pinned as a literal so it cannot drift silently", () => {
    /*
      Pinned as a LITERAL rather than derived. A test that read the constant and
      compared it to itself would pass whatever the number became, which is the
      velocity suite's failure recorded in CLAUDE.md: *a suite that cannot fail
      when its subject is deleted is how a dead control keeps a live
      reputation.* 13,500 ledger is 2,700 displayed — four Rolls and a Sign with
      40 spare, at P1-2's prices.
    */
    expect(FREE_SIGNUP_GRANT_CREDITS).toBe(13_500);
  });

  it("⚠ IS THE SAME NUMBER IN ALL THREE PLACES THAT USED TO HOLD A COPY", () => {
    /*
      Read off the REAL modules, never a fixture: `PLAN_TIERS` as the product
      declares it, and drizzle's own column object for the declared default —
      `credits.balance.default` is what `drizzle-kit` would emit, so this arm
      sees a hand-edited `.default(5000)` coming back.

      `INITIAL_CREDITS` is module-private in `server/db/credits.ts`, so its
      equality is read at the source text below rather than imported; a value
      that module keeps to itself cannot be asserted any other way without
      exporting it for the test, which would be a wider change than the fact.
    */
    expect(PLAN_TIERS.free.monthlyCredits).toBe(FREE_SIGNUP_GRANT_CREDITS);

    const declaredDefault = (credits as unknown as {
      balance: { default: unknown; hasDefault: boolean };
    }).balance;
    expect(declaredDefault.hasDefault).toBe(true);
    expect(declaredDefault.default).toBe(FREE_SIGNUP_GRANT_CREDITS);
  });

  it("⚠ AND `INITIAL_CREDITS` DERIVES IT RATHER THAN RESTATING IT", () => {
    const source = readListedSource(join(REPO_ROOT, "server", "db", "credits.ts"));
    expect(source, "server/db/credits.ts could not be read").not.toBeNull();

    /*
      The assertion is on the SHAPE of the declaration, not on a number: a
      literal there is the defect, whatever the literal says. So a future shift
      that "fixes" a drift by typing the new number in both places reddens this
      arm instead of passing it.
    */
    const declaration = /const\s+INITIAL_CREDITS\s*=\s*([^;]+);/.exec(source!);
    expect(declaration, "INITIAL_CREDITS is no longer declared in credits.ts").not.toBeNull();
    expect(declaration![1].trim()).toBe("FREE_SIGNUP_GRANT_CREDITS");
  });

  it("⚠ AND THE COLUMN DEFAULT CANNOT BE READ — THE SOLE INSERT NAMES `balance`", () => {
    /*
      This is the arm that makes the schema/database divergence harmless until
      the go-live ceremony runs. Drizzle does not apply `.default()` client-side
      for MySQL: it omits the column and the STORED default answers. So an
      INSERT that left `balance` out would grant whatever the live table still
      says — 5,000 today — and nothing would fail.

      `initializeUserCredits` is the only road that creates a row in this table
      (no `onDuplicateKeyUpdate` on it anywhere, read 2026-10-01), and it names
      the column.
    */
    const source = readListedSource(join(REPO_ROOT, "server", "db", "credits.ts"));
    expect(source).not.toBeNull();

    const insert = /insert\(credits\)\s*\.values\(\{([\s\S]*?)\}\)/.exec(source!);
    expect(insert, "the credits INSERT could not be found — this reader is stale").not.toBeNull();
    expect(insert![1]).toContain("balance:");
  });
});

describe("#1602 · the free grant is granted ONCE — the refresh road refuses it", () => {
  it("⚠ A FREE ROW'S SUBSCRIPTION INVOICE GRANTS NOTHING", async () => {
    /*
      Driven through the real exported entry point with a real clover invoice
      shape, so the early return at `server/stripe/webhooks.ts:848` is what
      answers rather than a constant read beside it.
    */
    const result = await deliver("free");

    expect(refreshMonthlyCredits).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toContain("Free tier");
  });

  it("⚠ AND THE ARM ABOVE CAN FAIL — THE SAME INVOICE ON A PAID ROW DOES REFRESH", async () => {
    /*
      THE POSITIVE CONTROL, and the only reason the arm above is evidence. A
      harness whose mocks stopped reaching the handler — a renamed export, a
      moved module, a dialect change in the invoice shape — would make "never
      called" true for the wrong reason and pass silently. This arm fails the
      moment the road stops being walked at all.
    */
    const result = await deliver("pro");

    expect(refreshMonthlyCredits).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });
});
