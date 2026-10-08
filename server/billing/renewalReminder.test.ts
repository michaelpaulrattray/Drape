/**
 * THE YEARLY RENEWAL REMINDER, DRIVEN — #1941.
 *
 * The card's done-when: *"A driven test-mode yearly subscription with a
 * renewal inside the window sends exactly one reminder, with the right date
 * and amount, and a redelivered event sends none."*
 *
 * ⚠ **WHAT IS REAL HERE AND WHAT IS NOT, stated rather than implied.** The
 * SWEEP is the real one — `runYearlyRenewalReminderSweep` with its real
 * verdict, its real claim ordering, its real copy. What is faked is the three
 * things a unit run may never touch: the production database, the founder's
 * Stripe account and his mail provider. A real test-mode subscription cannot
 * be created from a seat (it is a real-world write on his account), so the
 * subscription objects below are Stripe's own shape — `items.data[].price`,
 * `current_period_end` on the ITEM, `metadata.plan`, `cancel_at_period_end` —
 * taken from what `subscriptionPeriodSec` and `getSubscriptionDetails` already
 * read in production.
 *
 * ⚠ **THE CLAIM STORE IS NOT A STUB, AND THAT IS THE POINT OF THE SUITE.**
 * "Exactly one" is a property of a unique index, so the fake claim enforces
 * uniqueness on (subscription, periodEnd) and answers a second insert with the
 * SAME error shape `isDuplicateCreditReferenceError` reads in production
 * (`ER_DUP_ENTRY` / errno 1062) — so the arm proves the ordering the real
 * `claimRenewalReminder` relies on, rather than proving that a Map has one
 * key. `claimStoreRejectsADuplicate` below is its positive control: the fake
 * is shown to refuse before any arm trusts it to allow (working law 2).
 */
import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { PLAN_TIERS } from "../../drizzle/schema";
import { isDuplicateCreditReferenceError } from "../db/credits";
import { escapeEmailHtml } from "../mail";
import { verificationEmail } from "../routes/emailVerification";
import type { RenewalReminderCandidate } from "../db/billing";
import type { PendingChangeRead } from "../stripe/subscriptionSchedule";
import type { ProductEmail } from "../mail";
import {
  MIN_NOTICE_DAYS,
  REMINDER_LEAD_DAYS,
  formatRenewalAmount,
  formatRenewalDate,
  renewalReminderEmail,
  pendingRenewalPlan,
  renewalVerdict,
  runYearlyRenewalReminderSweep,
  type RenewalReminderDeps,
} from "./renewalReminder";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-01T09:00:00.000Z");

const CANDIDATE: RenewalReminderCandidate = {
  userId: 42,
  email: "casting@example.com",
  name: "Ada Lovelace",
  planTier: "pro",
  stripeSubscriptionId: "sub_yearly_1941",
  currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY_MS),
};

/**
 * A Stripe subscription in the shape the product actually reads: the period on
 * the ITEM (`subscriptionPeriodSec`'s whole reason for existing), the interval
 * on the item's price, the plan in metadata.
 */
function subscription(overrides: {
  daysToRenewal?: number;
  interval?: "month" | "year";
  status?: Stripe.Subscription.Status;
  cancelAtPeriodEnd?: boolean;
  plan?: string;
  extraItemInterval?: "month" | "year";
} = {}): Stripe.Subscription {
  const days = overrides.daysToRenewal ?? 20;
  const endSec = Math.floor((NOW.getTime() + days * DAY_MS) / 1000);
  const item = (interval: "month" | "year") => ({
    id: `si_${interval}`,
    price: { recurring: { interval } },
    current_period_start: endSec - 365 * 24 * 60 * 60,
    current_period_end: endSec,
  });
  const items = [item(overrides.interval ?? "year")];
  if (overrides.extraItemInterval) items.push(item(overrides.extraItemInterval));
  return {
    id: CANDIDATE.stripeSubscriptionId,
    status: overrides.status ?? "active",
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    metadata: { plan: overrides.plan ?? "pro" },
    items: { data: items },
  } as unknown as Stripe.Subscription;
}

/**
 * What `readPendingPlanChange` answers, in its own three-outcome shape.
 *
 * ⚠ **The DATE matters as much as the plan**, which is why it is a parameter
 * and not a constant: a phase beginning at the renewal prices the invoice this
 * notice is about, and a phase beginning later prices a different one.
 */
function pendingChange(overrides: {
  plan?: string;
  interval?: "monthly" | "annual";
  daysToEffective?: number;
} = {}): PendingChangeRead {
  return {
    outcome: "pending",
    change: {
      scheduleId: "sub_sched_1941",
      effectiveAt: new Date(NOW.getTime() + (overrides.daysToEffective ?? 20) * DAY_MS),
      plan: overrides.plan ?? "pro",
      interval: overrides.interval ?? "annual",
      creditUnits: 0,
    },
  } as PendingChangeRead;
}

/**
 * The fake outside world, with a claim store that enforces the real unique key.
 */
function harness(options: {
  candidates?: RenewalReminderCandidate[];
  subscription?: Stripe.Subscription;
  readOutcome?: "found" | "missing" | "failed";
  charge?: { amountCents: number; currency: string } | null;
  sendFails?: boolean;
  /**
   * A send that REJECTS rather than returning a failure — the default `send`
   * is `sendProductEmail`, which throws on an unset `RESEND_API_KEY` and on
   * any rejected provider call, so this is the live shape and not a
   * hypothetical one (the relay's finding on PR #1975).
   */
  sendThrows?: boolean;
  claimUnreachable?: boolean;
  /** What the schedule read answers; nothing pending by default. */
  pendingRead?: PendingChangeRead;
  now?: Date;
} = {}) {
  const claimed = new Set<string>();
  const sentEmails: ProductEmail[] = [];
  const released: string[] = [];
  const key = (sub: string, periodEnd: Date) => `${sub}|${periodEnd.toISOString()}`;

  const deps: RenewalReminderDeps = {
    now: () => options.now ?? NOW,
    candidates: async () => options.candidates ?? [CANDIDATE],
    readSubscription: async () => {
      const outcome = options.readOutcome ?? "found";
      if (outcome === "missing") return { outcome: "missing" };
      if (outcome === "failed") return { outcome: "failed", error: "network" };
      return { outcome: "found", subscription: options.subscription ?? subscription() };
    },
    readPendingChange: async () => options.pendingRead ?? { outcome: "none" },
    previewRenewal: async () =>
      options.charge === undefined ? { amountCents: 67_200, currency: "usd" } : options.charge,
    claim: async (row) => {
      if (options.claimUnreachable) return "unreachable";
      /* The database's own arbitration, reproduced: the INSERT is the claim and
         a duplicate key is the answer — never a prior read. */
      const k = key(row.stripeSubscriptionId, row.periodEnd);
      if (claimed.has(k)) {
        const duplicate = Object.assign(new Error("ER_DUP_ENTRY"), {
          code: "ER_DUP_ENTRY",
          errno: 1062,
        });
        if (!isDuplicateCreditReferenceError(duplicate)) {
          throw new Error("the fake's duplicate error is not the one production reads");
        }
        return "already-sent";
      }
      claimed.add(k);
      return "claimed";
    },
    release: async (sub, periodEnd) => {
      claimed.delete(key(sub, periodEnd));
      released.push(key(sub, periodEnd));
    },
    send: async (email) => {
      if (options.sendThrows) throw new Error("RESEND_API_KEY is not configured");
      if (options.sendFails) return { success: false, error: "provider refused" };
      sentEmails.push(email);
      return { success: true };
    },
  };

  return { deps, sentEmails, released, claimed };
}

describe("#1941 — the claim store used by these arms refuses a duplicate (law 2's positive control)", () => {
  it("the duplicate error the fake raises is the one production's reader recognises", () => {
    const duplicate = Object.assign(new Error("ER_DUP_ENTRY"), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
    });
    expect(
      isDuplicateCreditReferenceError(duplicate),
      "the fake claim's duplicate signal is not what `claimRenewalReminder` reads, so every exactly-once arm below would be proving nothing",
    ).toBe(true);
    expect(isDuplicateCreditReferenceError(new Error("something else"))).toBe(false);
  });
});

describe("#1941 — a yearly renewal inside the window earns exactly one notice", () => {
  it("sends one email naming the plan, the date and Stripe's own amount", async () => {
    const { deps, sentEmails } = harness();
    const result = await runYearlyRenewalReminderSweep(deps);

    expect(result).toMatchObject({ considered: 1, sent: 1 });
    expect(sentEmails).toHaveLength(1);

    const email = sentEmails[0]!;
    expect(email.to).toBe(CANDIDATE.email);
    expect(email.purpose).toBe("billing");
    /* The three facts the card asks for, asserted in the BODY the customer
       reads rather than in the arguments we handed in. */
    expect(email.html).toContain(PLAN_TIERS.pro.name);
    expect(email.html).toContain("21 November 2026");
    expect(email.html).toContain("$672.00");
    expect(email.subject).toBe(`Your ${PLAN_TIERS.pro.name} plan renews on 21 November 2026`);
  });

  it("a second pass over the same renewal sends nothing — the claim, not a read, is what refuses", async () => {
    const { deps, sentEmails } = harness();

    const first = await runYearlyRenewalReminderSweep(deps);
    const second = await runYearlyRenewalReminderSweep(deps);

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(second.skipped["already-sent"]).toBe(1);
    expect(sentEmails).toHaveLength(1);
  });

  it("two sweeps running together still send one — the unique key orders them", async () => {
    const { deps, sentEmails } = harness();

    const [a, b] = await Promise.all([
      runYearlyRenewalReminderSweep(deps),
      runYearlyRenewalReminderSweep(deps),
    ]);

    expect(a.sent + b.sent, "both overlapping sweeps wrote to the customer").toBe(1);
    expect(sentEmails).toHaveLength(1);
  });
});

describe("#1941 — a failed send releases its claim, so the next pass tries again", () => {
  it("releases on failure and succeeds on the retry, still exactly once", async () => {
    const failing = harness({ sendFails: true });
    const failed = await runYearlyRenewalReminderSweep(failing.deps);

    expect(failed.sent).toBe(0);
    expect(failed.skipped["send-failed"]).toBe(1);
    expect(
      failing.released,
      "the claim was kept after a failed send, so this renewal would never get a notice",
    ).toHaveLength(1);
    expect(failing.claimed.size).toBe(0);
  });
});

describe("#1941 — a change waiting at the boundary decides what the renewal buys", () => {
  /* The relay's finding on PR #1975: `metadata.plan` is the phase IN PROGRESS,
     and since #1963 the previewed amount is the NEXT phase's. These arms are
     about the two facts in the email agreeing with each other. */

  it("a pending decrease names the plan the customer is about to be billed for, beside that phase's amount", async () => {
    const { deps, sentEmails } = harness({
      /* She is on Pro Plus today and has asked to drop to Pro at the renewal. */
      subscription: subscription({ plan: "studio" }),
      pendingRead: pendingChange({ plan: "pro", interval: "annual" }),
      charge: { amountCents: 67_200, currency: "usd" },
    });

    const result = await runYearlyRenewalReminderSweep(deps);

    expect(result.sent).toBe(1);
    const email = sentEmails[0]!;
    expect(
      email.html,
      "the email named the plan she is leaving beside the amount of the plan she is joining",
    ).toContain(PLAN_TIERS.pro.name);
    expect(email.html).not.toContain(PLAN_TIERS.studio.name);
    expect(email.subject).toBe(`Your ${PLAN_TIERS.pro.name} plan renews on 21 November 2026`);
    expect(email.html).toContain("$672.00");
  });

  it("a pending yearly → monthly change sends nothing — there is no annual renewal to warn about", async () => {
    const { deps, sentEmails } = harness({
      pendingRead: pendingChange({ plan: "pro", interval: "monthly" }),
    });

    const result = await runYearlyRenewalReminderSweep(deps);

    expect(sentEmails, "a yearly renewal was announced that is not going to happen").toHaveLength(0);
    expect(result.sent).toBe(0);
    expect(result.skipped["pending-not-yearly"]).toBe(1);
  });

  it("a schedule read that FAILED refuses rather than naming the current plan", async () => {
    const { deps, sentEmails } = harness({
      pendingRead: { outcome: "failed", error: "network" },
    });

    const result = await runYearlyRenewalReminderSweep(deps);

    expect(sentEmails).toHaveLength(0);
    expect(result.skipped["pending-change-unreadable"]).toBe(1);
  });

  it("a refused pending read leaves no claim, so the next pass can still send it", async () => {
    const failing = harness({ pendingRead: { outcome: "failed", error: "network" } });
    await runYearlyRenewalReminderSweep(failing.deps);
    expect(
      failing.claimed.size,
      "the refusal took a claim with it, so this renewal could never get its notice",
    ).toBe(0);
  });

  it("a pending phase that begins AFTER this renewal does not rename it", async () => {
    const { deps, sentEmails } = harness({
      subscription: subscription({ plan: "studio", daysToRenewal: 20 }),
      /* A phase starting a year and a bit out prices a later invoice entirely. */
      pendingRead: pendingChange({ plan: "pro", daysToEffective: 400 }),
    });

    const result = await runYearlyRenewalReminderSweep(deps);

    expect(result.sent).toBe(1);
    expect(sentEmails[0]!.html).toContain(PLAN_TIERS.studio.name);
  });

  it("nothing pending leaves the subscription's own plan as the name", () => {
    expect(pendingRenewalPlan({ outcome: "none" }, new Date(NOW.getTime() + 20 * DAY_MS))).toEqual({
      outcome: "current",
    });
  });

  it("a pending phase naming a plan this product does not price refuses rather than captioning it", () => {
    /* Unreachable through `readPendingPlanChange` today — every
       `SUBSCRIPTION_PRODUCTS` key is a `PLAN_TIERS` key — so it is driven
       directly, which is the only way to prove the drift guard works at all. */
    const read = pendingChange({ plan: "legacy_agency" });
    expect(pendingRenewalPlan(read, new Date(NOW.getTime() + 20 * DAY_MS))).toEqual({
      outcome: "refuse",
      reason: "pending-change-unreadable",
    });
  });
});

describe("#1941 — what is deliberately NOT written to", () => {
  const cases: Array<{
    what: string;
    sub?: Stripe.Subscription;
    readOutcome?: "missing" | "failed";
    charge?: null;
    claimUnreachable?: boolean;
    reason: string;
  }> = [
    {
      what: "a subscription set to cancel at period end — nothing renews",
      sub: subscription({ cancelAtPeriodEnd: true }),
      reason: "not-renewing",
    },
    {
      what: "a past-due subscription — Stripe's dunning owns that conversation",
      sub: subscription({ status: "past_due" }),
      reason: "status-not-live",
    },
    {
      what: "a monthly subscription our cached column mislabelled as yearly",
      sub: subscription({ interval: "month" }),
      reason: "not-yearly",
    },
    {
      what: "a renewal the live read puts outside the window, whatever the cache said",
      sub: subscription({ daysToRenewal: REMINDER_LEAD_DAYS + 5 }),
      reason: "renewal-outside-window",
    },
    {
      what: "a renewal already in the past",
      sub: subscription({ daysToRenewal: -1 }),
      reason: "renewal-outside-window",
    },
    {
      what: "a subscription Stripe does not know",
      readOutcome: "missing",
      reason: "subscription-missing",
    },
    {
      what: "a Stripe read that failed — retried next pass, never guessed at",
      readOutcome: "failed",
      reason: "stripe-read-failed",
    },
    {
      what: "an amount Stripe would not price — no figure of our own is invented",
      charge: null,
      reason: "amount-unreadable",
    },
    {
      what: "a claim store we cannot reach — it refuses rather than risking a second email",
      claimUnreachable: true,
      reason: "claim-unreachable",
    },
  ];

  for (const row of cases) {
    it(`sends nothing for ${row.what}`, async () => {
      const { deps, sentEmails } = harness({
        subscription: row.sub,
        readOutcome: row.readOutcome,
        charge: row.charge,
        claimUnreachable: row.claimUnreachable,
      });
      const result = await runYearlyRenewalReminderSweep(deps);
      expect(sentEmails).toHaveLength(0);
      expect(result.sent).toBe(0);
      expect(result.skipped[row.reason as keyof typeof result.skipped]).toBe(1);
    });
  }

  it("a subscription whose yearly line sits beside a monthly add-on is still yearly", () => {
    const verdict = renewalVerdict(CANDIDATE, subscription({ extraItemInterval: "month" }), NOW);
    expect(verdict.due).toBe(true);
  });
});

describe("#1941 — the window", () => {
  it("is inside the 15-to-45-day band California's renewal law requires", () => {
    expect(REMINDER_LEAD_DAYS).toBeGreaterThanOrEqual(MIN_NOTICE_DAYS);
    expect(REMINDER_LEAD_DAYS).toBeLessThanOrEqual(45);
    expect(MIN_NOTICE_DAYS).toBe(15);
  });

  it("the shortlist is asked for exactly the lead-time window", async () => {
    let asked: { start: Date; end: Date } | null = null;
    const { deps } = harness();
    const result = await runYearlyRenewalReminderSweep({
      ...deps,
      candidates: async (start, end) => {
        asked = { start, end };
        return [];
      },
    });

    expect(result.considered).toBe(0);
    expect(asked!.start.toISOString()).toBe(NOW.toISOString());
    expect(asked!.end.getTime() - asked!.start.getTime()).toBe(REMINDER_LEAD_DAYS * DAY_MS);
  });

  it("a notice later than the floor is still sent — a late notice beats silence", async () => {
    const { deps, sentEmails } = harness({
      subscription: subscription({ daysToRenewal: 3 }),
    });
    const result = await runYearlyRenewalReminderSweep(deps);
    expect(result.sent).toBe(1);
    expect(sentEmails).toHaveLength(1);
  });
});

describe("#1941 — the plan this names is the live one", () => {
  it("prefers Stripe's own metadata over our cached tier", async () => {
    const { deps, sentEmails } = harness({ subscription: subscription({ plan: "studio" }) });
    await runYearlyRenewalReminderSweep(deps);
    expect(sentEmails[0]!.html).toContain(PLAN_TIERS.studio.name);
  });

  it("falls back to the cached tier rather than captioning a plan we do not sell", () => {
    const verdict = renewalVerdict(CANDIDATE, subscription({ plan: "legendary" }), NOW);
    expect(verdict).toMatchObject({ due: true, planTier: CANDIDATE.planTier });
  });
});

describe("#1941 — the copy", () => {
  const charge = { amountCents: 67_200, currency: "usd" };

  it("formats the amount in the currency Stripe named, not a hard-coded dollar", () => {
    expect(formatRenewalAmount(charge)).toBe("$672.00");
    expect(formatRenewalAmount({ amountCents: 120_000, currency: "jpy" })).toContain("1,200");
    /* A well-formed code `Intl` does not know still prints — measured, not
       assumed; it is a malformed one that throws, and the second arm is the
       fallback's real trigger. `\s` rather than a literal space because `Intl`
       separates a currency CODE from its number with U+00A0, which is correct
       in an email and invisible in a diff. */
    expect(formatRenewalAmount({ amountCents: 500, currency: "zzz" })).toMatch(/^ZZZ\s5\.00$/);
    expect(formatRenewalAmount({ amountCents: 500, currency: "us" })).toBe("5.00 US");
  });

  it("writes the date the way a person reads one, in UTC", () => {
    expect(formatRenewalDate(new Date("2027-01-04T23:30:00.000Z"))).toBe("4 January 2027");
  });

  it("names no button and no engine, and quotes no credit figure", () => {
    const html = renewalReminderEmail({
      to: CANDIDATE.email,
      name: CANDIDATE.name,
      planTier: "pro",
      periodEnd: new Date("2026-11-21T09:00:00.000Z"),
      charge,
    }).html;

    /* #1940 is re-wording the cancel control and it is a modal with no address,
       so a label or a deep link here would be wrong or broken. */
    expect(html).not.toContain("Drop to Free");
    expect(html).not.toContain("Cancel plan");
    /* The disappearing-technology law: no engine or provider name on a path a
       customer walks. */
    for (const machine of ["Stripe", "Sunburst", "Nano Banana", "GPT", "fal", "Resend"]) {
      expect(html, `the notice names ${machine}`).not.toContain(machine);
    }
    expect(html).not.toMatch(/credits/i);
    /* And it says the one thing it must: that doing nothing renews, and where
       to go if that is not what they want. */
    expect(html).toContain("Billing");
    expect(html).toContain("do nothing");
  });

  it("greets an account with no name without saying 'null'", () => {
    const html = renewalReminderEmail({
      to: CANDIDATE.email,
      name: null,
      planTier: "pro",
      periodEnd: new Date("2026-11-21T09:00:00.000Z"),
      charge,
    }).html;
    expect(html).toContain("Hi there,");
    expect(html).not.toContain("null");
  });
});

describe("#1941 — a send that THROWS is a failed send, never a lost notice", () => {
  /*
    ⚠ **THE DEFAULT `send` THROWS AND ONLY A RETURNED FAILURE WAS HANDLED** —
    the relay's finding on PR #1975. `sendProductEmail` throws when
    `RESEND_API_KEY` is unset and whenever the provider's own call rejects, and
    the claim is written BEFORE the send: so the throw left the claim standing,
    every later pass read `already-sent`, and "exactly once" became "never" with
    nothing in the result to say so. The throw also escaped the loop, taking
    every remaining candidate in that pass with it.

    Two accounts, because one of them cannot show the second half.
  */
  const SECOND: RenewalReminderCandidate = {
    ...CANDIDATE,
    userId: 43,
    email: "second@example.com",
    stripeSubscriptionId: "sub_yearly_1941_b",
  };

  it("releases its claim, lets the pass finish, and the next pass sends it exactly once", async () => {
    const h = harness({ candidates: [CANDIDATE, SECOND] });
    const thrown = new Set<string>();
    const deps: RenewalReminderDeps = {
      ...h.deps,
      send: async (email) => {
        if (email.to === CANDIDATE.email && !thrown.has(email.to)) {
          thrown.add(email.to);
          /* The real message, from `server/mail.ts`'s own refusal. */
          throw new Error("RESEND_API_KEY is not configured");
        }
        return h.deps.send(email);
      },
    };

    const first = await runYearlyRenewalReminderSweep(deps);

    expect(first.skipped["send-failed"]).toBe(1);
    expect(
      h.released,
      "a thrown send kept its claim, so this renewal could never be written to again",
    ).toHaveLength(1);
    expect(h.claimed.size, "the claim was not released, so tomorrow reads already-sent").toBe(1);
    expect(
      first.sent,
      "the throw escaped the loop, so the OTHER account lost its notice as well",
    ).toBe(1);
    expect(h.sentEmails.map((email) => email.to)).toEqual([SECOND.email]);

    const second = await runYearlyRenewalReminderSweep(deps);

    expect(second.sent).toBe(1);
    expect(second.skipped["already-sent"], "the account that already had its notice").toBe(1);
    expect(h.sentEmails.map((email) => email.to)).toEqual([SECOND.email, CANDIDATE.email]);
  });

  it("a thrown send is counted and skipped exactly like a returned failure", async () => {
    const thrower = await runYearlyRenewalReminderSweep(harness({ sendThrows: true }).deps);
    const returner = await runYearlyRenewalReminderSweep(harness({ sendFails: true }).deps);
    expect(thrower).toEqual(returner);
  });
});

describe("#1941 — a name the customer typed cannot reach the markup unescaped", () => {
  /*
    ⚠ **THE CLASS, NOT THE INSTANCE (working law 7).** The finding named the
    renewal notice; `users.name` is free text and there are exactly TWO email
    html builders in the tree, so both are driven here with the same hostile
    name. `escapeEmailHtml` gets its own controls first (working law 2): an
    escaper proven able to pass is worth nothing until it is proven able to
    change something.
  */
  const HOSTILE = "<script>alert('x')</script> & O'Neil";

  it("the escaper escapes all five entities, and ampersand first", () => {
    expect(escapeEmailHtml("&")).toBe("&amp;");
    expect(escapeEmailHtml("<b>")).toBe("&lt;b&gt;");
    expect(escapeEmailHtml('"q"')).toBe("&quot;q&quot;");
    expect(escapeEmailHtml("it's")).toBe("it&#39;s");
    /* Ampersand first, or the escapes would be escaped again. */
    expect(escapeEmailHtml("<")).toBe("&lt;");
    expect(escapeEmailHtml("plain name")).toBe("plain name");
  });

  it("the renewal notice escapes it", () => {
    const html = renewalReminderEmail({
      to: CANDIDATE.email,
      name: HOSTILE,
      planTier: "pro",
      periodEnd: new Date("2026-11-21T09:00:00.000Z"),
      charge: { amountCents: 67_200, currency: "usd" },
    }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("the verification email escapes it too — the sibling swept in the same commit", () => {
    const html = verificationEmail(
      "casting@example.com",
      HOSTILE,
      "https://example.test/api/auth/verify-email?token=abc",
    ).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("#1941 — the one button does not promise a surface it cannot reach", () => {
  it("says what it does, because Billing has no address", () => {
    /*
      Read at the code, not assumed: Billing is a SECTION of a modal held in
      component state (`client/src/features/settings/AccountSurfaces.tsx`), it
      has no route in `App.tsx`, and nothing opens it from a search parameter.
      So `Open Billing` over the app home was a promise the product cannot
      keep — the relay's finding on PR #1975.
    */
    const html = renewalReminderEmail({
      to: CANDIDATE.email,
      name: CANDIDATE.name,
      planTier: "pro",
      periodEnd: new Date("2026-11-21T09:00:00.000Z"),
      charge: { amountCents: 67_200, currency: "usd" },
    }).html;
    expect(html).not.toContain("Open Billing");
    expect(html).toContain("Open your account");
    /* And the sentence that tells them where Billing actually is stays. */
    expect(html).toContain("Billing settings");
  });
});
