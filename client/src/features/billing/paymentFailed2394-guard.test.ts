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

/* The relay's finding on PR #2440, item 2: Add credits' plan pane sent the
   same customer to the same Checkout. Sliced to that pane, so an identical
   line in the packs pane cannot satisfy these arms. */
const addCredits = withoutComments(readFileSync(join(BILLING, "AddCreditsModal.tsx"), "utf8"));
const stepUp = sourceBand(addCredits, "function PlanStepUpPane(", "\nfunction ", "PlanStepUpPane");
const stepUpSubmit = sourceBand(stepUp, "const submit = () => {", "\n  };", "PlanStepUpPane submit");

describe("#2394 sweep — Add credits' plan pane", () => {
  it("derives the same failed-payment state", () => {
    expect(stepUp).toMatch(
      /const paymentFailed =\s*status\?\.subscriptionStatus === "past_due" \|\| status\?\.subscriptionStatus === "unpaid";/,
    );
  });

  it("⚠ submit routes it to the card BEFORE either purchase road", () => {
    const failedAt = stepUpSubmit.indexOf("if (paymentFailed) {");
    const checkoutAt = stepUpSubmit.indexOf("checkout.mutate(");
    expect(failedAt).toBeGreaterThan(-1);
    expect(checkoutAt).toBeGreaterThan(-1);
    expect(failedAt).toBeLessThan(checkoutAt);
    expect(stepUpSubmit).toMatch(/if \(paymentFailed\) \{\s*portal\.mutate\(\);\s*return;\s*\}/);
    expect(stepUp).toMatch(/const portal = trpc\.billing\.createPortalSession\.useMutation\(/);
  });

  it("the button says Update card, and is not held behind a quote it will never use", () => {
    expect(stepUp).toMatch(
      /\{paymentFailed \? \(\s*<Button[^>]*onClick=\{submit\}\s*disabled=\{portal\.isPending\}\s*>\s*\{portal\.isPending \? "Opening…" : "Update card"\}/,
    );
  });
});

/* #2441 — the relay's finding on PR #2440's frames: the pane above that button
   still read as a sale. *Choose a plan*, a price *due today* and the purchase
   bullets stood over the notice, so the page offered what it then would not
   sell. Every arm reads the PlanStepUpPane slice, so a sibling in the packs
   pane cannot satisfy it. */
describe("#2441 — a failed payment is not shown a purchase screen", () => {
  /* What prices a plan on this pane. Each is a class or a word only the
     purchase body draws. */
  const PURCHASE = [
    'className="dp-topup__adjust"',
    'className="dp-topup__pricerow"',
    'className="dp-topup__due"',
    "due today",
    'className="dp-topup__select"',
    'className="dp-topup__bullets"',
    'className="dp-topup__renewal"',
  ];
  const NOTICE = "Your last payment didn&apos;t go through";

  const gate = sourceBand(stepUp, "{paymentFailed ? (", "</>", "the #2441 gate");
  const split = gate.indexOf(") : (");
  const failedArm = gate.slice(0, split);
  const purchaseArm = gate.slice(split);
  const outside = stepUp.replace(gate, "");

  it("the heading and the dialog's name say what there is to do", () => {
    expect(stepUp).toContain('label={paymentFailed ? "Update your card" : "Choose a plan"}');
    expect(stepUp).toContain('<h2 className="dp-topup__title">{paymentFailed ? "Update your card" : "Choose a plan"}</h2>');
  });

  it("⚠ the notice leads — it is the failed arm of the gate under the heading, and it is said once", () => {
    expect(split).toBeGreaterThan(-1);
    expect(failedArm).toContain(NOTICE);
    expect(failedArm).toContain('role="status"');
    expect(stepUp.indexOf('<h2 className="dp-topup__title">')).toBeLessThan(stepUp.indexOf(gate));
    expect(stepUp.split(NOTICE).length - 1, "a second copy of the notice is back").toBe(1);
  });

  it("⚠ nothing that prices a plan is drawn on the failed arm, or outside the gate", () => {
    for (const mark of PURCHASE) {
      expect(failedArm, `the failed-payment arm draws ${mark}`).not.toContain(mark);
      expect(outside, `${mark} sits outside the gate, so a failed payment sees it`).not.toContain(mark);
    }
  });

  it("POSITIVE CONTROL — every purchase mark is really on the purchase arm", () => {
    /* Without this, a mark misspelled above passes both negative arms by
       matching nothing anywhere. */
    for (const mark of PURCHASE) {
      expect(purchaseArm, `the purchase arm lost ${mark}`).toContain(mark);
    }
  });
});
