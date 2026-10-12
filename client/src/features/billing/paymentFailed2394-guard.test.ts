/**
 * #2394 — A SUBSCRIBER WHOSE PAYMENT FAILED IS NOT SENT TO CHECKOUT.
 *
 * `getStatus` answers `hasSubscription` only for an `active` plan, so a
 * `past_due` / `unpaid` subscriber read as having none, and Change plan's
 * `act()` sent their Upgrade to `createSubscriptionCheckout` — a second live
 * subscription — and hid Cancel plan.
 *
 * These arms pin the client half at the source, in this directory's house
 * style (`planChangeRefusal1987-guard.test.ts`). The server half — the guard
 * that refuses the second subscription whoever asks — is driven through the
 * real router in `server/routes/oneSubscriptionGuard2394.test.ts`, and the
 * press itself was driven in the running app (the PR carries the frames and
 * the request log).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

const BILLING = join(process.cwd(), "client", "src", "features", "billing");
const changePlanModal = withoutComments(readFileSync(join(BILLING, "ChangePlanModal.tsx"), "utf8"));

const act = sourceBand(changePlanModal, "const act = (plan: LadderPlan) => {", "\n  };", "act()");
const footer = sourceBand(changePlanModal, '<footer className="dp-plan__foot">', "</footer>", "the footer");

describe("#2394 — the failed-payment state is its own state", () => {
  it("is derived from BOTH of Stripe's failed-payment statuses", () => {
    expect(changePlanModal).toMatch(
      /const paymentFailed =\s*status\?\.subscriptionStatus === "past_due" \|\| status\?\.subscriptionStatus === "unpaid";/,
    );
  });

  it("⚠ act() routes it to the card BEFORE the checkout branch can be reached", () => {
    const failedAt = act.indexOf("if (paymentFailed) {");
    const noSubAt = act.indexOf("if (!hasSubscription) {");
    const checkoutAt = act.indexOf("checkout.mutate(");
    expect(failedAt).toBeGreaterThan(-1);
    expect(noSubAt).toBeGreaterThan(-1);
    expect(checkoutAt).toBeGreaterThan(-1);
    expect(failedAt).toBeLessThan(noSubAt);
    expect(failedAt).toBeLessThan(checkoutAt);
    expect(act).toMatch(/if \(paymentFailed\) \{\s*portal\.mutate\(\);\s*return;\s*\}/);
  });

  it("the card road is the Billing tab's own — Stripe's portal, not a new procedure", () => {
    expect(changePlanModal).toMatch(/const portal = trpc\.billing\.createPortalSession\.useMutation\(/);
  });

  it("a notice says so first, with Update card beside it", () => {
    const notice = sourceBand(
      changePlanModal,
      "{paymentFailed ? (",
      ") : null}",
      "the failed-payment notice",
    );
    expect(notice).toContain("Your last payment didn&apos;t go through");
    expect(notice).toMatch(/onClick=\{\(\) => portal\.mutate\(\)\}/);
    expect(notice).toContain('"Update card"');
  });

  it("Update card is the view's one ink button — no plan card and no compare footer carries one", () => {
    expect(changePlanModal).toMatch(/const primaryId = paymentFailed \? null : offered\?\.id \?\? null;/);
    expect(footer).toMatch(/\{compare && offered && offered\.id !== currentId && !paymentFailed \? \(/);
  });

  it("⚠ Cancel plan stays in reach for them — the footer's plan control counts them as holding a plan", () => {
    /* #2395 moved the footer onto `planFootControl`; this card feeds it. */
    expect(changePlanModal).toMatch(/const holdsPlan = hasSubscription === true \|\| paymentFailed;/);
    expect(changePlanModal).toMatch(/useQuery\(undefined, \{\s*enabled: holdsPlan,\s*\}\)/);
    expect(changePlanModal).toMatch(/planFootControl\(\s*holdsPlan \? true : hasSubscription,/);
    expect(footer).toMatch(/\{footControl === "cancel" \? \(\s*<Button[^>]*onClick=\{\(\) => setConfirmingDrop\(true\)\}/);
  });
});
