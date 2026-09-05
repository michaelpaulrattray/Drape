import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⚠ **#531 — THE ORDERED GUARD. His order (Crew reply #130, 2026-09-04),
 * verbatim:**
 *
 * > *"Stripe: the live address is https://klieglabs.com; fix it as code, one
 * > production base URL read from one place, used by both the checkout return
 * > and the manage-subscription return, with a test that nothing in the
 * > product points at drape.app or drape.ai; nobody has paid yet, so don't
 * > wait on that."*
 *
 * Its sibling #467 carries the measurement: `server/routes/billing.ts` held
 * the same three-line `NODE_ENV` ternary twice, both naming `https://drape.app`
 * — a domain the production service has never served — as Stripe's
 * `success_url`/`cancel_url` and the portal return. A paying customer was
 * sent there the moment their payment succeeded.
 *
 * # The arms, and why each exists
 *
 * 1. **The wire** (working law 5): the checkout and portal procedures are
 *    DRIVEN through the real router with Stripe mocked at the module edge,
 *    and the URLs asserted are the ones handed to the outgoing call — not a
 *    constant near them. Both directions: production → the live origin, dev →
 *    localhost, which also proves `appBaseUrl()` reads the environment at
 *    call time.
 * 2. **The ordered sweep**: no file the product ships names either retired
 *    drape domain. Population: `client/src`, `server`, `shared` — the three
 *    roots the client and server bundles are built from.
 * 3. **One place** (working law 4): the production origin literal appears in
 *    exactly one product file. The two billing copies had already drifted
 *    together onto a dead domain; a second copy is how it happens again.
 * 4. **Controls** (working law 2): the scanner is driven over the real
 *    pre-fix bytes (must catch) and the live address (must not), through the
 *    same regex the reading uses — never a restated copy.
 *
 * # ⚠ The sweep's enumerated exclusions, each with its reason
 *
 * - `*.test.ts` / `*.test.tsx`: fixtures are a test's INPUT (the established
 *   precedent in `contactAddresses.test.ts` — `mike@drape.ai` is a
 *   disposable-email fixture, and this very file quotes his order, which
 *   names both domains).
 * - `server/crew/crew-briefing.json`: the founder's own briefing record. It
 *   quotes this defect and his order verbatim; it is prose he reads about the
 *   product, not a destination the product sends a customer to.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const PRODUCT_ROOTS = ["client/src", "server", "shared"];
const PRODUCT_EXTENSIONS = /\.(tsx?|jsx?|css|html|json)$/;
const TEST_FILE = /\.test\.tsx?$/;
const EXCLUDED_FILES = ["server/crew/crew-briefing.json"];

/**
 * ⚠ ONE REGEX, shared by the reading and its controls (the `MAILTO`
 * discipline in `contactAddresses.test.ts`). Dots are ESCAPED — interpolated
 * raw, `drape.ai` reads as `drape<any>ai` and a host like `drapeXai` would
 * cry wolf (the lesson PR #465's gate review filed). The trailing `\b` stops
 * `drape.aims` / `drape.application` matching; a preceding subdomain
 * (`mail.drape.ai`) still matches on the domain itself.
 */
const RETIRED_DRAPE_DOMAIN = /drape\.(?:app|ai)\b/gi;

const retiredDomainHitsIn = (text: string, file: string): { file: string; hit: string }[] =>
  [...text.matchAll(new RegExp(RETIRED_DRAPE_DOMAIN.source, "gi"))].map((m) => ({
    file,
    hit: m[0],
  }));

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    return PRODUCT_EXTENSIONS.test(entry.name) ? [full] : [];
  });

/** Every file the sweep reads, as repo-relative POSIX paths. */
const productFiles = (): string[] =>
  PRODUCT_ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root)))
    .map((full) => path.relative(REPO_ROOT, full).replace(/\\/g, "/"))
    .filter((rel) => !TEST_FILE.test(rel) && !EXCLUDED_FILES.includes(rel));

describe("#531 — nothing in the product points at drape.app or drape.ai", () => {
  it("the population is real, and the sweep can see the files the defect lived in", () => {
    /*
      An absence arm over an empty (or wrong) population is green when the
      walker breaks. Assert it walked the exact files this card is about
      before believing it found nothing wrong in them.
    */
    const files = productFiles();
    expect(files.length, "the walker found no product files").toBeGreaterThan(0);
    for (const mustSee of [
      "server/routes/billing.ts",
      "server/routes/referral.ts",
      "server/_core/appOrigin.ts",
      "client/src/pages/Login.tsx",
    ]) {
      expect(files, `the sweep is not looking at ${mustSee}`).toContain(mustSee);
    }
  });

  it("HIS TEST — no product file names a retired drape domain", () => {
    const offenders = productFiles()
      .flatMap((rel) => retiredDomainHitsIn(fs.readFileSync(path.join(REPO_ROOT, rel), "utf8"), rel))
      .map(({ file, hit }) => `${file} → ${hit}`);

    expect(
      offenders,
      `The product still points at a retired drape domain:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("the excluded briefing record still exists — the exclusion names a real file, not a typo", () => {
    for (const rel of EXCLUDED_FILES) {
      expect(
        fs.existsSync(path.join(REPO_ROOT, rel)),
        `${rel} is excluded from the sweep but does not exist — fix or drop the exclusion`,
      ).toBe(true);
    }
  });

  it("POSITIVE CONTROL — the real pre-fix bytes, driven through the real scanner", () => {
    /* The shipped bug, byte for byte — all three product shapes it took. */
    const shipped = [
      `        ? "https://drape.app" `,
      "        user.email || `user-${ctx.user.id}@drape.app`,",
      `    const baseUrl = ctx.req.headers.origin || "https://drape.ai";`,
      /* The subdomain shape a regression would plausibly take. */
      `const url = "https://app.drape.ai/checkout";`,
    ];
    for (const bytes of shipped) {
      expect(
        retiredDomainHitsIn(bytes, "sabotage.ts").length,
        `the scanner no longer sees the shipped bug: ${bytes}`,
      ).toBeGreaterThan(0);
    }

    /* And what must NOT be caught — an arm that flags everything is not an arm. */
    const clean = [
      `const baseUrl = "https://klieglabs.com";`,
      /* The unescaped-dot false positive: any character standing in for the dot. */
      `const brand = "drapeXai";`,
      /* The missing-\b false positives. */
      `import { drape } from "./drape.applique";`,
      `// she will drape.aims aside`,
    ];
    for (const bytes of clean) {
      expect(
        retiredDomainHitsIn(bytes, "clean.ts"),
        `the scanner cries wolf on: ${bytes}`,
      ).toEqual([]);
    }
  });

  it("ONE PLACE — the production origin literal is declared exactly once (working law 4)", () => {
    const declaring = productFiles().filter((rel) =>
      fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").includes("https://klieglabs.com"),
    );
    expect(
      declaring,
      "the production origin is declared somewhere besides appOrigin.ts — a second copy always drifts",
    ).toEqual(["server/_core/appOrigin.ts"]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * THE WIRE — the URLs actually handed to Stripe (working law 5).
 * ──────────────────────────────────────────────────────────────────────────── */

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getUserById: vi.fn(),
  getSubscriptionByUserId: vi.fn(),
  updateUserSubscription: vi.fn(),
}));

vi.mock("./stripe/stripeService", () => ({
  stripe: {},
  getOrCreateStripeCustomer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
  calculateProration: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  calculateCreditAdjustment: vi.fn(),
  getCustomerInvoices: vi.fn(),
  getAllCustomerInvoices: vi.fn(),
}));

vi.mock("./auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getUserById, getSubscriptionByUserId } from "./db";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckoutSession,
  createCustomerPortalSession,
} from "./stripe/stripeService";
import { PRODUCTION_APP_ORIGIN, PRODUCTION_APP_HOSTNAME, appBaseUrl } from "./_core/appOrigin";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createApprovedContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user = {
    id: 99,
    openId: "billing-test-open-id",
    email: "customer@example.com",
    name: "Paying Customer",
    displayName: null,
    avatarUrl: null,
    avatarKey: null,
    bannerUrl: null,
    bannerKey: null,
    bio: null,
    loginMethod: "email",
    approved: true,
    role: "user",
    storageUsed: 0,
    storageLimit: 104857600,
    suspendedAt: null,
    suspendedReason: null,
    suspendedBy: null,
    frozenAt: null,
    frozenReason: null,
    frozenBy: null,
    referralCode: null,
    referredByUserId: null,
    accessCode: "TEST_APPROVED",
    approvedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AuthenticatedUser;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("#531 — the return URLs on the wire to Stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserById).mockResolvedValue(
      createApprovedContext().user as Awaited<ReturnType<typeof getUserById>>,
    );
    vi.mocked(getSubscriptionByUserId).mockResolvedValue({
      stripeCustomerId: "cus_test_531",
    } as Awaited<ReturnType<typeof getSubscriptionByUserId>>);
    vi.mocked(getOrCreateStripeCustomer).mockResolvedValue("cus_test_531");
    vi.mocked(createSubscriptionCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/c/pay/test",
    );
    vi.mocked(createCustomerPortalSession).mockResolvedValue(
      "https://billing.stripe.com/p/session/test",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("checkout return: in production, both URLs sent to Stripe are on the live origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const caller = appRouter.createCaller(createApprovedContext());

    await caller.billing.createSubscriptionCheckout({ plan: "starter" });

    expect(createSubscriptionCheckoutSession).toHaveBeenCalledTimes(1);
    const [, , successUrl, cancelUrl] = vi.mocked(createSubscriptionCheckoutSession).mock.calls[0];
    expect(successUrl).toBe("https://klieglabs.com/app?billing=success");
    expect(cancelUrl).toBe("https://klieglabs.com/app?billing=canceled");
  });

  it("manage-subscription return: in production, the portal return URL is on the live origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const caller = appRouter.createCaller(createApprovedContext());

    await caller.billing.createPortalSession();

    expect(createCustomerPortalSession).toHaveBeenCalledTimes(1);
    const [, returnUrl] = vi.mocked(createCustomerPortalSession).mock.calls[0];
    expect(returnUrl).toBe("https://klieglabs.com/app");
  });

  it("outside production the same wire carries the dev server — the base is read at call time", async () => {
    /* NODE_ENV is "test" here; no stub. */
    const caller = appRouter.createCaller(createApprovedContext());

    await caller.billing.createPortalSession();

    const [, returnUrl] = vi.mocked(createCustomerPortalSession).mock.calls[0];
    expect(returnUrl).toBe("http://localhost:3000/app");
  });

  it("an account with no email gets its Stripe placeholder on the live hostname, derived not copied", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(getUserById).mockResolvedValue(
      createApprovedContext({ email: null as unknown as string }).user as Awaited<
        ReturnType<typeof getUserById>
      >,
    );
    const caller = appRouter.createCaller(createApprovedContext());

    await caller.billing.createSubscriptionCheckout({ plan: "starter" });

    const [, placeholderEmail] = vi.mocked(getOrCreateStripeCustomer).mock.calls[0];
    expect(placeholderEmail).toBe(`user-99@${PRODUCTION_APP_HOSTNAME}`);
    expect(PRODUCTION_APP_HOSTNAME).toBe("klieglabs.com");
  });

  it("the constant is his live address, and the helper honours both environments", () => {
    expect(PRODUCTION_APP_ORIGIN).toBe("https://klieglabs.com");

    vi.stubEnv("NODE_ENV", "production");
    expect(appBaseUrl()).toBe(PRODUCTION_APP_ORIGIN);
    vi.unstubAllEnvs();
    expect(appBaseUrl()).toBe("http://localhost:3000");
  });
});
