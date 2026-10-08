import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #796 — the two REQUEST-path writes in `routes/billing.ts` that dropped the db
 * helper's verdict (the law-7 remainder of #792, whose six sites were webhook
 * handlers). `updateUserSubscription` never throws: a failed write comes back
 * `{ success: false }`, and a caller that does not read it proceeds as if the
 * row moved.
 *
 * # Site 1 — `createSubscriptionCheckout`, the `stripeCustomerId` save
 *
 * Read at the code, the exposure is WORSE than the card's "second customer":
 * `customer.subscription.created` finds the account BY `stripeCustomerId`
 * (`getUserByStripeCustomerId`, the webhook's first read). With the id unsaved,
 * a session minted against that customer produces a paid subscription whose
 * every webhook fails on every redelivery — the customer pays and the account
 * never becomes the plan. So the fix REFUSES the checkout, and the arm that
 * matters is at the wire (working law 5): a failed save must mean NO call to
 * `createSubscriptionCheckoutSession`, not merely a thrown error after one.
 *
 * # Site 2 — `changePlan`, the local record write
 *
 * By that line Stripe has accepted the change. Throwing would tell a customer
 * their upgrade failed when it did not, and a retry meets "You are already on
 * this plan" because `changePlan` reads the current plan off Stripe. The
 * webhook (`subscription.updated`, failing its event on a lost write since
 * #794) is the corrector, so the procedure still answers success — and the
 * audit row names the road (`localRecord: deferred-to-webhook`), which is the
 * one artifact support can read when an account shows its old tier.
 *
 * Both sites are driven through the real router with Stripe and the db
 * mocked at the module edge, and each has its positive control.
 */

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
}));

vi.mock("../stripe/stripeService", () => ({
  stripe: {},
  getOrCreateStripeCustomer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  readSubscriptionBillingState: vi.fn(),
  quotePlanChange: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  calculateCreditAdjustment: vi.fn(),
  getCustomerInvoices: vi.fn(),
  getAllCustomerInvoices: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { billingRouter } from "./billing";
import { getSubscriptionByUserId, getUserById, updateUserSubscription } from "../db";
import {
  createSubscriptionCheckoutSession,
  getOrCreateStripeCustomer,
  quotePlanChange,
  readSubscriptionBillingState,
  updateSubscriptionPlan,
} from "../stripe/stripeService";
import { logAuditEvent } from "../auditLog";
import {
  PRICE_UNAVAILABLE_SENTENCE,
  StripePriceUnavailableError,
} from "../stripe/stripePriceCatalogue";
import { SpokenError } from "../_core/spokenError";

const USER = { id: 42, approved: true, suspendedAt: null, lockedUntil: null };
const caller = () => billingRouter.createCaller({ user: USER, req: { headers: {} } } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserById).mockResolvedValue({
    id: 42,
    frozenAt: null,
    email: "customer@example.com",
  } as Awaited<ReturnType<typeof getUserById>>);
  vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_new");
  vi.mocked(createSubscriptionCheckoutSession).mockResolvedValue(
    "https://checkout.stripe.com/c/pay/test",
  );
});

describe("#796 site 1 — the stripeCustomerId save before a checkout", () => {
  beforeEach(() => {
    // A first-time buyer: no customer id on the account yet.
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: null,
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
  });

  it("a failed save REFUSES the checkout — no session is minted against a customer the account cannot claim", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    await expect(caller().createSubscriptionCheckout({ plan: "starter" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("Nothing was charged"),
    });

    // The wire: the refusal happens BEFORE Stripe is asked for a session.
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("positive control: a successful save proceeds to mint the session", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });

    const out = await caller().createSubscriptionCheckout({ plan: "starter" });

    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(updateUserSubscription).toHaveBeenCalledWith(42, { stripeCustomerId: "cus_new" });
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("a saved id that Stripe no longer honours — the helper mints a NEW one — takes the same road: saved, and refused on a failed save (PR #797 review)", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_stale",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_new");
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    await expect(caller().createSubscriptionCheckout({ plan: "starter" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });

    expect(updateUserSubscription).toHaveBeenCalledWith(42, { stripeCustomerId: "cus_new" });
    expect(createSubscriptionCheckoutSession).not.toHaveBeenCalled();

    // And the successful save proceeds, against the NEW id.
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });
    const out = await caller().createSubscriptionCheckout({ plan: "starter" });
    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(vi.mocked(createSubscriptionCheckoutSession).mock.calls[0][0]).toBe("cus_new");
  });

  it("a returning buyer with an id already saved never touches the save, so the guard cannot refuse them", async () => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_known",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_known");
    // Even a helper that WOULD fail is never asked.
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: false, error: "boom" });

    const out = await caller().createSubscriptionCheckout({ plan: "starter" });

    expect(out.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/test");
    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
  });
});

describe("#796 site 2 — changePlan's local record after Stripe has accepted the change", () => {
  beforeEach(() => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_known",
      planTier: "starter",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(readSubscriptionBillingState).mockResolvedValue({
      currentPlan: "starter",
      subscriptionItemId: "si_1",
      /* A running plan (#1987) — every arm here is about a road past the gate. */
      status: "active",
      collectionPaused: false,
      endsAtSec: null,
    } as Awaited<ReturnType<typeof readSubscriptionBillingState>>);
    // An interval-neutral change with no credit movement: the credit road is
    // not what this arm measures, and keeping it out of the way makes the
    // record write the only db verdict on the road.
    vi.mocked(quotePlanChange).mockReturnValue({
      kind: "same-interval",
      currentPlan: "starter",
      currentInterval: "monthly",
      targetInterval: "monthly",
      creditAdjustment: 0,
      creditUnwind: 0,
      isUpgrade: true,
      proratedAmount: 0,
      /* ⚠ THE DIAL, AT THE BOTTOM AND UNMOVED (#1832) — and these two are
         present because leaving them off is what FOUND a real defect rather
         than merely reddening this suite. `as ReturnType<…>` satisfies the
         compiler on a partial object, so the omission reached the request
         path, where `planCreditSliderLedgerCredits` refused `undefined` —
         from inside the audit block, which runs AFTER Stripe has accepted and
         invoiced the change. That is this very file's own #796 class: a throw
         past the point of no return hands the customer an error for a change
         that happened. The arithmetic moved ahead of the Stripe call; these
         fields make the double honest about what a quote is. */
      currentCreditUnits: 0,
      targetCreditUnits: 0,
    } as ReturnType<typeof quotePlanChange>);
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_1",
      invoiceStatus: "paid",
      invoicedAmount: 0,
    } as Awaited<ReturnType<typeof updateSubscriptionPlan>>);
  });

  const auditMetadata = () => {
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    return vi.mocked(logAuditEvent).mock.calls[0][0].metadata as Record<string, unknown>;
  };

  it("a failed record write does NOT fail the customer — Stripe already accepted the change and the webhook corrects the row — and the audit row says so", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({
      success: false,
      error: "Database not available",
    });

    const out = await caller().changePlan({ newPlan: "pro" });

    expect(out.success).toBe(true);
    expect(updateUserSubscription).toHaveBeenCalledWith(42, {
      planTier: "pro",
      billingInterval: "month",
    });
    expect(auditMetadata().localRecord).toBe("deferred-to-webhook");
  });

  it("positive control: a written record is recorded as written", async () => {
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true });

    const out = await caller().changePlan({ newPlan: "pro" });

    expect(out.success).toBe(true);
    expect(auditMetadata().localRecord).toBe("written");
  });
});

/**
 * #1605 BULLET 1 — WHAT THE CUSTOMER READS WHEN THE CATALOGUE CANNOT PRICE
 * THEIR PLAN, which is the half of the refusal no wire arm can see.
 *
 * `resolvePriceId` refuses with the lookup key in its message, on purpose: the
 * repair is one read in Stripe and the person doing it needs the key. The
 * disappearing-technology law governs the other reader — *no engine name on a
 * path someone must walk*, and *a refusal says what was refused and what to
 * do* — so these arms assert the sentence that reaches the screen and the
 * absence of the key from it.
 *
 * Driven through the real router, with the refusal injected at the service
 * boundary exactly as `resolvePriceId` raises it.
 */
describe("#1605 bullet 1 — a price the catalogue cannot supply, as the customer hears it", () => {
  const refusal = () =>
    new StripePriceUnavailableError(
      "klieg_pro_yearly_v2",
      "names no active price in Stripe's catalogue",
    );

  beforeEach(() => {
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_known",
      stripeSubscriptionId: "sub_1",
      planTier: "starter",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_known");
  });

  it("CHECKOUT answers the authored sentence, and the key is nowhere in it", async () => {
    vi.mocked(createSubscriptionCheckoutSession).mockRejectedValue(refusal());

    const error = await caller()
      .createSubscriptionCheckout({ plan: "pro", interval: "annual" })
      .then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).message).toBe(PRICE_UNAVAILABLE_SENTENCE);
    /* The whole point. A lookup key, a price id or the word Stripe on the
       screen is this law failing, however accurate it is. */
    expect((error as SpokenError).message).not.toContain("klieg");
    expect((error as SpokenError).message).not.toMatch(/stripe|lookup|price_/i);
    /* And the sentence says the two things somebody actually needs. */
    expect((error as SpokenError).message).toMatch(/nothing was charged/i);
  });

  it("PLAN CHANGE answers the same sentence rather than the client's lost-contact line", async () => {
    /* The reason this arm exists: `updateSubscriptionPlan` reports every other
       failure as `{ success: false }`, which the route turns into an UNMARKED
       error — and the modal answers an unmarked one with *"We lost contact
       while changing your plan. Check your plan before trying again."* Nothing
       is attempted when this fires, so that sentence would send somebody to
       check a plan that never moved. */
    vi.mocked(readSubscriptionBillingState).mockResolvedValue({
      currentPlan: "starter",
      subscriptionItemId: "si_1",
      /* A running plan (#1987) — every arm here is about a road past the gate. */
      status: "active",
      collectionPaused: false,
      endsAtSec: null,
    } as Awaited<ReturnType<typeof readSubscriptionBillingState>>);
    vi.mocked(quotePlanChange).mockReturnValue({
      kind: "same-interval",
      currentPlan: "starter",
      currentInterval: "monthly",
      targetInterval: "monthly",
      creditAdjustment: 0,
      creditUnwind: 0,
      isUpgrade: true,
      proratedAmount: 0,
      /* ⚠ THE DIAL, AT THE BOTTOM AND UNMOVED (#1832) — and these two are
         present because leaving them off is what FOUND a real defect rather
         than merely reddening this suite. `as ReturnType<…>` satisfies the
         compiler on a partial object, so the omission reached the request
         path, where `planCreditSliderLedgerCredits` refused `undefined` —
         from inside the audit block, which runs AFTER Stripe has accepted and
         invoiced the change. That is this very file's own #796 class: a throw
         past the point of no return hands the customer an error for a change
         that happened. The arithmetic moved ahead of the Stripe call; these
         fields make the double honest about what a quote is. */
      currentCreditUnits: 0,
      targetCreditUnits: 0,
    } as ReturnType<typeof quotePlanChange>);
    vi.mocked(updateSubscriptionPlan).mockRejectedValue(refusal());

    const error = await caller()
      .changePlan({ newPlan: "pro" })
      .then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(SpokenError);
    expect((error as SpokenError).message).toBe(PRICE_UNAVAILABLE_SENTENCE);
    expect((error as SpokenError).message).not.toContain("klieg");
    /* Nothing was written locally either — the refusal is ahead of the row. */
    expect(updateUserSubscription).not.toHaveBeenCalled();
  });

  it("the negative control: any OTHER failure is NOT given this sentence", async () => {
    /* Without this, the translator could be rewriting every billing failure
       into one reassuring line — including a genuine Stripe decline, where
       "nothing was charged" may be false. */
    vi.mocked(createSubscriptionCheckoutSession).mockRejectedValue(new Error("card_declined"));

    const error = await caller()
      .createSubscriptionCheckout({ plan: "pro", interval: "annual" })
      .then(() => null, (e: unknown) => e);

    expect(error).not.toBeInstanceOf(SpokenError);
    expect((error as Error).message).toBe("card_declined");
  });
});

/**
 * #1832 — THE CREDIT SLIDER'S ARITHMETIC CANNOT THROW PAST THE POINT OF NO
 * RETURN.
 *
 * This file's own #796 class, one feature later. `planCreditSliderLedgerCredits`
 * REFUSES anything that is not a whole number of steps — correct for a money
 * helper — and the audit row and the confirmation sentence that read it both
 * run AFTER `updateSubscriptionPlan` has succeeded. Computed down there, a
 * refusal means Stripe has already changed the plan and invoiced for it while
 * the customer is handed an error for a change that happened.
 *
 * ⚠ **IT WAS A LIVE DEFECT, FOUND BY THIS SUITE AND NOT BY THE COMPILER.** The
 * quote is typed to carry both step counts, so the expression looked safe; the
 * doubles above are cast with `as ReturnType<…>`, which satisfies the compiler
 * on a partial object, and the omission walked straight into the request path.
 * That is a fair model of the real exposure rather than a fixture artefact —
 * the type is a claim about `quotePlanChange`, and nothing one statement past
 * a charge should rest on a claim.
 *
 * The arm drives the bad shape ON PURPOSE and asserts WHERE the refusal lands:
 * before Stripe is touched. Its positive control is the same call with the
 * fields present, which must reach Stripe and succeed.
 */
describe("#1832 — a quote missing its step counts refuses BEFORE Stripe is touched", () => {
  const quoteWithout = (extra: Record<string, unknown>) =>
    ({
      kind: "same-interval",
      currentPlan: "starter",
      currentInterval: "monthly",
      targetInterval: "monthly",
      creditAdjustment: 0,
      creditUnwind: 0,
      isUpgrade: true,
      proratedAmount: 0,
      ...extra,
    }) as ReturnType<typeof quotePlanChange>;

  beforeEach(() => {
    vi.mocked(getUserById).mockResolvedValue({ ...USER, frozenAt: null } as never);
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_known",
      stripeSubscriptionId: "sub_1",
      planTier: "starter",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(readSubscriptionBillingState).mockResolvedValue({
      currentPlan: "starter",
      subscriptionItemId: "si_1",
      /* A running plan (#1987) — every arm here is about a road past the gate. */
      status: "active",
      collectionPaused: false,
      endsAtSec: null,
      currentInterval: "monthly",
      periodStartSec: 1_700_000_000,
      periodEndSec: 1_702_592_000,
      currentCreditUnits: 0,
      creditItemId: null,
    } as Awaited<ReturnType<typeof readSubscriptionBillingState>>);
    vi.mocked(updateUserSubscription).mockResolvedValue({ success: true } as never);
    vi.mocked(updateSubscriptionPlan).mockResolvedValue({
      success: true,
      invoiceId: "in_1",
      invoiceStatus: "paid",
      invoicedAmount: 0,
    } as Awaited<ReturnType<typeof updateSubscriptionPlan>>);
  });

  it("⚠ NOTHING REACHES STRIPE — the refusal is ahead of the charge, not behind it", async () => {
    vi.mocked(quotePlanChange).mockReturnValue(quoteWithout({}));

    const error = await caller()
      .changePlan({ newPlan: "pro" })
      .then(() => null, (e: unknown) => e);

    expect(error, "the bad shape was accepted — the arm is asserting nothing").not.toBeNull();
    expect(
      updateSubscriptionPlan,
      "Stripe was called and THEN the arithmetic threw — the customer is charged and told it failed",
    ).not.toHaveBeenCalled();
  });

  it("POSITIVE CONTROL — the same call with the step counts present reaches Stripe and succeeds", async () => {
    vi.mocked(quotePlanChange).mockReturnValue(
      quoteWithout({ currentCreditUnits: 0, targetCreditUnits: 0 }),
    );

    const result = await caller().changePlan({ newPlan: "pro" });

    expect(result.success).toBe(true);
    expect(updateSubscriptionPlan).toHaveBeenCalledTimes(1);
  });
});
