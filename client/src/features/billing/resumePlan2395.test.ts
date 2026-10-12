/**
 * #2395 — AFTER A CANCEL THERE IS A WAY BACK, AND CANCEL PLAN IS NOT OFFERED
 * TWICE.
 *
 * Settings → Billing is driven through React's own renderer with the tRPC
 * hooks stubbed at the wire they read (`getSubscriptionDetails`,
 * `reactivateSubscription`), so what is asserted is the button the browser
 * would draw and the mutation its press fires. The Change plan dialog is 2,500
 * lines over a dozen queries, so its footer is held two ways instead: the
 * decision function it calls is driven directly, and the footer is read (with
 * comments stripped) to prove it branches on that decision and nothing else.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sourceBand } from "../../../../server/testing/sourceBand";
import { withoutComments } from "../../../../server/testing/withoutComments";

/* ── the wire ─────────────────────────────────────────────────────────── */

type Details = { cancelAtPeriodEnd: boolean; pendingChange: null; billingInterval: string } | null;
const wire = {
  details: null as Details,
  detailsSettled: true,
  reactivateOptions: null as null | { onSuccess: () => void; onError: (e: unknown) => void },
  reactivateMutate: vi.fn(),
  scheduledMutate: vi.fn(),
  invalidated: [] as string[],
};

function query<T>(data: T, settled = true) {
  return { data, isSuccess: settled, isError: false };
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      billing: {
        getSubscriptionDetails: { invalidate: () => wire.invalidated.push("getSubscriptionDetails") },
        getStatus: { invalidate: () => wire.invalidated.push("getStatus") },
      },
    }),
    billing: {
      getInvoices: { useQuery: () => query({ invoices: [] }) },
      getStatus: { useQuery: () => query({ planTier: "pro" }) },
      /* #2392 — the plan card reads the credit dial's rung and position. */
      getPlans: { useQuery: () => query({ creditSlider: { planId: "studio", maxUnits: 76 } }) },
      getPlanCreditUnits: { useQuery: () => query({ units: 0 }) },
      getSubscriptionDetails: {
        useQuery: () =>
          wire.detailsSettled ? query(wire.details) : { data: undefined, isSuccess: false, isError: false },
      },
      cancelScheduledChange: { useMutation: () => ({ isPending: false, mutate: wire.scheduledMutate }) },
      createPortalSession: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      reactivateSubscription: {
        useMutation: (options: typeof wire.reactivateOptions) => {
          wire.reactivateOptions = options;
          return { isPending: false, mutate: wire.reactivateMutate };
        },
      },
    },
  },
}));

const toasts = { success: [] as string[], error: [] as string[] };
vi.mock("sonner", () => ({
  toast: {
    success: (m: string) => toasts.success.push(m),
    error: (m: string) => toasts.error.push(m),
  },
}));

vi.mock("@/features/settings/ReferralBlock", () => ({ ReferralBlock: () => null }));

/* Every Button the section draws is recorded with its handler, so a press can
   be driven without a DOM. */
const buttons: { label: string; onClick?: () => void }[] = [];
const labelOf = (children: ReactNode): string =>
  Array.isArray(children) ? children.map(labelOf).join("") : String(children ?? "");
vi.mock("@/foundation", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
    buttons.push({ label: labelOf(children), onClick });
    return createElement("button", null, children);
  },
}));

const { BillingSection } = await import("../settings/sections/BillingSection");
const { cancelStateOf, planFootControl } = await import("./resumePlan");
const { planResumedReceipt } = await import("@shared/planCancelCopy");

const PERIOD_END = new Date("2026-11-09T12:00:00Z");

function render(): { text: string; labels: string[] } {
  buttons.length = 0;
  const html = renderToStaticMarkup(
    createElement(BillingSection, {
      planName: "Pro",
      planPriceInCents: 2900,
      allowance: 100000,
      balance: 50000,
      renewsAt: PERIOD_END,
      onChangePlan: () => {},
      onAddCredits: () => {},
    }),
  );
  return {
    text: html
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " "),
    labels: buttons.map((b) => b.label),
  };
}

beforeEach(() => {
  wire.details = null;
  wire.detailsSettled = true;
  wire.reactivateOptions = null;
  wire.reactivateMutate.mockClear();
  wire.scheduledMutate.mockClear();
  wire.invalidated.length = 0;
  toasts.success.length = 0;
  toasts.error.length = 0;
});

const renewing: Details = { cancelAtPeriodEnd: false, pendingChange: null, billingInterval: "month" };
const ending: Details = { cancelAtPeriodEnd: true, pendingChange: null, billingInterval: "month" };

describe("Settings → Billing, a plan set to end", () => {
  it("offers Resume plan in place of Change plan, and pressing it fires reactivateSubscription", () => {
    wire.details = ending;
    const { text, labels } = render();
    expect(text).toContain("won't renew");
    expect(labels).toContain("Resume plan");
    expect(labels).not.toContain("Change plan");
    buttons.find((b) => b.label === "Resume plan")!.onClick!();
    expect(wire.reactivateMutate).toHaveBeenCalledTimes(1);
  });

  it("NEGATIVE CONTROL: a renewing plan offers Change plan and no Resume", () => {
    wire.details = renewing;
    const { text, labels } = render();
    expect(text).toContain("renews");
    expect(labels).toContain("Change plan");
    expect(labels).not.toContain("Resume plan");
  });

  it("NEGATIVE CONTROL: while the details are unread it offers no Resume", () => {
    wire.detailsSettled = false;
    expect(render().labels).not.toContain("Resume plan");
  });

  it("the receipt says when it renews, off the same period end the cancel line quoted, and both reads refresh", () => {
    wire.details = ending;
    render();
    wire.reactivateOptions!.onSuccess();
    expect(toasts.success).toEqual([planResumedReceipt(PERIOD_END)]);
    expect(toasts.success[0]).toBe("Your plan is back on. It renews on 9 Nov.");
    expect(wire.invalidated.sort()).toEqual(["getStatus", "getSubscriptionDetails"]);
  });

  it("a failed resume says so and never claims the plan is back", () => {
    wire.details = ending;
    render();
    wire.reactivateOptions!.onError(new Error("network"));
    expect(toasts.success).toEqual([]);
    expect(toasts.error).toHaveLength(1);
    expect(toasts.error[0]).not.toMatch(/back on/);
  });
});

describe("the receipt has a true date-less form", () => {
  it("names no date it has not read", () => {
    expect(planResumedReceipt(null)).toBe("Your plan is back on. It renews as usual.");
    expect(planResumedReceipt("not a date")).toBe("Your plan is back on. It renews as usual.");
  });
});

describe("the Change plan dialog's footer decision", () => {
  it("a subscriber whose plan is ending is offered Resume, never Cancel", () => {
    expect(planFootControl(true, cancelStateOf(ending, true))).toBe("resume");
  });
  it("NEGATIVE CONTROL: a renewing subscriber is offered Cancel", () => {
    expect(planFootControl(true, cancelStateOf(renewing, true))).toBe("cancel");
  });
  it("an unread subscription, or an unread cancel state, offers neither", () => {
    expect(planFootControl(null, "renewing")).toBeNull();
    expect(planFootControl(true, cancelStateOf(ending, false))).toBeNull();
  });
  it("a free account offers neither", () => {
    expect(planFootControl(false, cancelStateOf(ending, true))).toBeNull();
  });
  it("a settled read Stripe could not describe still lets a subscriber cancel", () => {
    expect(planFootControl(true, cancelStateOf(null, true))).toBe("cancel");
  });
});

describe("the dialog's footer branches on that decision", () => {
  const modal = withoutComments(
    readFileSync(join(process.cwd(), "client", "src", "features", "billing", "ChangePlanModal.tsx"), "utf8"),
  );
  const footer = sourceBand(modal, '<footer className="dp-plan__foot">', "</footer>", "plan footer");

  it("Cancel plan is drawn only on the cancel branch, Resume plan only on the resume branch", () => {
    expect(footer).toMatch(/footControl === "cancel" \? \(\s*<Button[^>]*onClick=\{\(\) => setConfirmingDrop\(true\)\}>\s*Cancel plan/);
    expect(footer).toMatch(/footControl === "resume" \? \([\s\S]*?onClick=\{\(\) => resumePlan\.mutate\(\)\}[\s\S]*?"Resume plan"/);
    /* NEGATIVE CONTROL: the old gate, which stayed true through a cancel, is gone. */
    expect(footer).not.toMatch(/hasSubscription === true \?/);
  });

  it("the cancel state is read off getSubscriptionDetails, asked only for a subscriber", () => {
    expect(modal).toMatch(
      /trpc\.billing\.getSubscriptionDetails\.useQuery\(undefined, \{\s*enabled: hasSubscription === true,\s*\}\)/,
    );
    expect(modal).toMatch(/const footControl = planFootControl\(\s*hasSubscription,\s*cancelStateOf\(/);
  });
});
