/**
 * #2456 — A PLAN HOLDER WHOSE PLAN IS PAUSED IS SHOWN HOW TO RESUME, NOT THE
 * PACKS.
 *
 * #2454 made the server refuse a pack on a paused plan, and the Add credits
 * pane still drew the packs — the press was the first the customer heard of
 * it. The pause lives only at Stripe, so the shell now asks
 * `billing.getTopupStanding` (driven through the real router and the real
 * Stripe library in `server/routes/topupStanding2456.test.ts`) and routes a
 * paused plan to its own pane.
 *
 * Source arms in this directory's house style (`packsPaymentFailed2454-guard`),
 * each sliced to the component it is about so a sibling cannot satisfy it. The
 * pane was rendered in the running app, both themes (frames on the PR).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

const BILLING = join(process.cwd(), "client", "src", "features", "billing");
const surface = withoutComments(readFileSync(join(BILLING, "AddCreditsModal.tsx"), "utf8"));

const shell = sourceBand(
  surface,
  "export function AddCreditsModal",
  "\nfunction HeldCreditsShell(",
  "the shell",
);
const mayBuy = sourceBand(shell, 'if (eligibility === "may-buy") {', "\n  }", "the may-buy branch");
const pane = sourceBand(surface, "function PausedPlanPacksPane(", "\nfunction ", "PausedPlanPacksPane");

describe("#2456 — the shell asks whether the plan is paused", () => {
  it("asks the standing query, only on the road whose next pane is the packs", () => {
    expect(shell).toMatch(/const standingAsked = eligibility === "may-buy" && !paymentFailed;/);
    expect(shell).toMatch(
      /trpc\.billing\.getTopupStanding\.useQuery\(undefined, \{\s*enabled: standingAsked,\s*\}\)/,
    );
  });

  it("⚠ a paused plan gets the resume pane, decided BEFORE the packs", () => {
    const pausedAt = mayBuy.indexOf(
      "if (standing.data?.planPaused === true) return <PausedPlanPacksPane onClose={onClose} />;",
    );
    const packsAt = mayBuy.indexOf("<CreditPacksPane");
    expect(pausedAt, "the paused branch is gone from the may-buy road").toBeGreaterThan(-1);
    expect(pausedAt).toBeLessThan(packsAt);
  });

  it("⚠ the packs wait for the answer rather than drawing and then being withdrawn", () => {
    const heldAt = mayBuy.indexOf("if (standing.isPending) {");
    const packsAt = mayBuy.indexOf("<CreditPacksPane");
    expect(heldAt, "the packs no longer wait on the standing read").toBeGreaterThan(-1);
    expect(heldAt).toBeLessThan(packsAt);
    expect(mayBuy.slice(heldAt, packsAt)).toContain("return <HeldCreditsShell onClose={onClose} />;");
  });

  it("CONTROL — an active plan (and an unread one) still reaches the packs, once and unconditionally", () => {
    expect(mayBuy).toMatch(
      /return <CreditPacksPane onClose=\{onClose\} onChangePlan=\{onChangePlan\} \/>;/,
    );
    expect(mayBuy.split("<CreditPacksPane").length - 1).toBe(1);
    /* `null` (unread) must not route to the paused pane: the test is `=== true`. */
    expect(mayBuy).not.toMatch(/planPaused !== false|!standing\.data\?\.planPaused|planPaused \?\?/);
  });
});

describe("#2456 — the paused pane sells nothing", () => {
  it("says what happened and what to do", () => {
    expect(pane).toContain('label="Resume your plan"');
    expect(pane).toContain('<h2 className="dp-topup__title">Resume your plan</h2>');
    expect(pane).toContain("Your plan is paused");
    expect(pane).toContain('role="status"');
  });

  it("its one button opens the billing page, and says so rather than promising a resume", () => {
    expect(pane).toMatch(/const portal = trpc\.billing\.createPortalSession\.useMutation\(/);
    expect(pane).toMatch(/onClick=\{\(\) => portal\.mutate\(\)\}/);
    expect(pane).toContain('"Open billing"');
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
      expect(pane, `the paused pane reaches ${mark}`).not.toContain(mark);
    }
  });
});
