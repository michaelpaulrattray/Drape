/**
 * #2454 — A PLAN HOLDER WHOSE PAYMENT FAILED IS SHOWN THE CARD, NOT THE PACKS.
 *
 * His word, 2026-10-12, verbatim: *"you need to be on an active plan to buy
 * credit packs."* The Add credits shell chose the packs by the plan rung, and
 * the rung still reads Pro after a card fails.
 *
 * Source arms in this directory's house style (`paymentFailed2394-guard`),
 * each sliced to the component it is about so a sibling cannot satisfy it. The
 * server half — the refusal whoever asks — is driven through the real router
 * and the real Stripe library in `server/routes/topupActivePlan2454.test.ts`,
 * and the pane itself was rendered in the running app (frames on the PR).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

const BILLING = join(process.cwd(), "client", "src", "features", "billing");
const surface = withoutComments(readFileSync(join(BILLING, "AddCreditsModal.tsx"), "utf8"));

const shell = sourceBand(surface, "export function AddCreditsModal", "<ModalScrim", "the shell");
const mayBuy = sourceBand(shell, 'if (eligibility === "may-buy") {', "\n  }", "the may-buy branch");
const pane = sourceBand(
  surface,
  "function PaymentFailedPacksPane(",
  "\nfunction ",
  "PaymentFailedPacksPane",
);

describe("#2454 — the shell routes a failed payment away from the packs", () => {
  it("derives the failed-payment state from BOTH of Stripe's failed-payment statuses", () => {
    expect(shell).toMatch(
      /const paymentFailed =\s*status\?\.subscriptionStatus === "past_due" \|\| status\?\.subscriptionStatus === "unpaid";/,
    );
  });

  it("⚠ a failed payment on a paid rung gets the card pane, decided BEFORE the packs", () => {
    const failedAt = mayBuy.indexOf("if (paymentFailed) return <PaymentFailedPacksPane onClose={onClose} />;");
    const packsAt = mayBuy.indexOf("<CreditPacksPane");
    expect(failedAt, "the failed-payment branch is gone from the may-buy road").toBeGreaterThan(-1);
    expect(packsAt).toBeGreaterThan(-1);
    expect(failedAt).toBeLessThan(packsAt);
  });

  it("CONTROL — an active plan holder is still shown the packs, unconditionally after that branch", () => {
    expect(mayBuy).toMatch(
      /return <CreditPacksPane onClose=\{onClose\} onChangePlan=\{onChangePlan\} \/>;/,
    );
    /* The packs are not hidden behind a second gate that would refuse an
       active subscriber too (law 2: a gate that refuses everybody passes every
       refusal arm). */
    expect(mayBuy.split("<CreditPacksPane").length - 1).toBe(1);
    expect(mayBuy).not.toMatch(/!paymentFailed/);
  });
});

describe("#2454 — the card pane sells nothing", () => {
  it("says what happened and what to do, under the plan pane's heading", () => {
    expect(pane).toContain('label="Update your card"');
    expect(pane).toContain('<h2 className="dp-topup__title">Update your card</h2>');
    expect(pane).toContain("Your last payment didn&apos;t go through");
    expect(pane).toContain('role="status"');
  });

  it("its button is Update card, on the Billing tab's own road — Stripe's portal", () => {
    expect(pane).toMatch(/const portal = trpc\.billing\.createPortalSession\.useMutation\(/);
    expect(pane).toMatch(/onClick=\{\(\) => portal\.mutate\(\)\}/);
    expect(pane).toContain('"Update card"');
  });

  it("⚠ no purchase road and no price is reachable from it", () => {
    for (const mark of [
      "createTopupCheckout",
      "createSubscriptionCheckout",
      "changePlan",
      "formatDollars",
      "topupPriceInCents",
      "dp-topup__packs",
      "dp-topup__slider",
    ]) {
      expect(pane, `the failed-payment pane reaches ${mark}`).not.toContain(mark);
    }
  });
});
