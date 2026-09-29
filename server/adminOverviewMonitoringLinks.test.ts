/**
 * ⚠ WHETHER THERE IS A DASHBOARD TO LINK TO (#1441) — his *"Links — no fourth
 * key"* on #1419, Desk reply #229.
 *
 * He declined a fourth Sentry key that would have let this product READ his
 * errors back and print a count on his admin page. So the page links out
 * instead, and the ONE thing the server has to answer is whether a link would
 * lead anywhere: a link to a project no key points at is #1419's own *"0 errors
 * today"* lie wearing a different hat — he clicks, finds an empty dashboard,
 * and reads it as *nothing is broken* rather than as *nobody switched it on*.
 *
 * Two claims, and they are asserted in different places on purpose:
 *
 *   1. **The readers answer the environment**, both directions, including the
 *      blank-string case a Railway variable really produces. That is what the
 *      first block drives.
 *   2. **`admin.getOverview` actually SENDS them.** Invariant 5 — a reader that
 *      is right and unwired is invariant 7's *control that is not invoked*, and
 *      this repository has paid for that shape enough times to stop asserting
 *      round a procedure and calling it covered. So the second block calls the
 *      real procedure through a real caller and reads the real payload, with
 *      only the database faked.
 *
 * The client's half — WHICH links that answer produces, and that the label
 * never names a vendor — is
 * `client/src/features/admin/overview/dashboards.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorReportingConfigured } from "./monitoring/errorTracker";
import { productEventsConfigured } from "./monitoring/productEvents";

const KEYS = ["SENTRY_DSN", "POSTHOG_API_KEY"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    const previous = saved[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("is there a dashboard to link to — read at the variable, not at boot", () => {
  it("says yes when the key is set, on both halves", () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    process.env.POSTHOG_API_KEY = "phc_abc123";
    expect(errorReportingConfigured()).toBe(true);
    expect(productEventsConfigured()).toBe(true);
  });

  it("says no when the key is absent", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.POSTHOG_API_KEY;
    expect(errorReportingConfigured()).toBe(false);
    expect(productEventsConfigured()).toBe(false);
  });

  it("⚠ says no for a BLANK variable, which is what an emptied Railway row is", () => {
    /* A variable cleared on the dashboard arrives as `""`, not as absent. The
       repository has been bitten by the other half of this exact class — a
       blank row passed to `parseInt` through `??`, giving NaN (memory:
       `nullish-default-misses-empty-string`) — and a blank DSN here would mean
       a link to a dashboard nothing reports to, which is the one state these
       booleans exist to prevent. */
    for (const blank of ["", "   ", "\n"]) {
      process.env.SENTRY_DSN = blank;
      process.env.POSTHOG_API_KEY = blank;
      expect(errorReportingConfigured(), JSON.stringify(blank)).toBe(false);
      expect(productEventsConfigured(), JSON.stringify(blank)).toBe(false);
    }
  });

  it("⚠ answers before anything has started — the two halves can disagree, and neither is boot state", () => {
    /* The readers deliberately do NOT go through `errorTrackerStatus()` or
       `productEventStreamStatus()`, whose `configured` fields are written by
       the start functions. Nothing in this suite starts either tracker, so if
       these were reading boot state every arm above would answer `false` and
       the first arm would have caught it. */
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    delete process.env.POSTHOG_API_KEY;
    expect(errorReportingConfigured()).toBe(true);
    expect(productEventsConfigured()).toBe(false);
  });
});

describe("⚠ and `admin.getOverview` SENDS them — asserted on the payload", () => {
  async function overviewPayload(): Promise<Record<string, unknown>> {
    /* Only the database is faked. The router, the procedure, the admin
       middleware and the two readers are the real ones. */
    vi.doMock("./db/adminOverviewQueries", () => ({
      getGenerationHealth: async () => ({
        total24h: 0,
        completed24h: 0,
        failed24h: 0,
        pending: 0,
        processing: 0,
        successRate: 100,
      }),
      getActiveUsers24h: async () => 0,
      getUserGrowthMetrics: async () => ({}),
      getCreditEconomyMetrics: async () => ({}),
      getGovernanceMetrics: async () => ({}),
      getRecentAlerts: async () => [],
    }));
    vi.doMock("./db/announcementQueries", () => ({ getActiveBannerCount: async () => 0 }));

    const { overviewRouter } = await import("./routes/admin/overview");
    const caller = overviewRouter.createCaller({
      /* Role-only, which is what admin access actually is: the allowlist admits
         everyone while it is empty, and it is empty in production. */
      user: { id: 1, role: "admin", email: "founder@example.com", openId: "o1" },
      req: { headers: {} },
      res: {},
    } as never);
    return (await caller.getOverview()) as unknown as Record<string, unknown>;
  }

  it("carries both flags as TRUE when both keys are set", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    process.env.POSTHOG_API_KEY = "phc_abc123";
    expect((await overviewPayload()).monitoring).toEqual({
      errorsConfigured: true,
      eventsConfigured: true,
    });
  });

  it("carries both as FALSE when neither is — no link, rather than a link to nothing", async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.POSTHOG_API_KEY;
    expect((await overviewPayload()).monitoring).toEqual({
      errorsConfigured: false,
      eventsConfigured: false,
    });
  });

  it("⚠ reports them INDEPENDENTLY — one key set is one link, not two and not none", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    delete process.env.POSTHOG_API_KEY;
    expect((await overviewPayload()).monitoring).toEqual({
      errorsConfigured: true,
      eventsConfigured: false,
    });
  });

  it("⚠ carries no COUNT, no issue, no event — the fourth key he declined is not here", async () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    process.env.POSTHOG_API_KEY = "phc_abc123";
    const monitoring = (await overviewPayload()).monitoring as Record<string, unknown>;
    /* The whole content of his ruling: the page says a dashboard EXISTS and
       never what is on it. A third key here — an error count, a worst route —
       would be the read-back he declined, arriving without anybody deciding to
       add it. */
    expect(Object.keys(monitoring).sort()).toEqual(["errorsConfigured", "eventsConfigured"]);
    for (const value of Object.values(monitoring)) expect(typeof value).toBe("boolean");
  });

  it("re-reads on every call, so a key pasted between two polls shows up", async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.POSTHOG_API_KEY;
    expect((await overviewPayload()).monitoring).toMatchObject({ errorsConfigured: false });

    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    expect((await overviewPayload()).monitoring).toMatchObject({ errorsConfigured: true });
  });
});
