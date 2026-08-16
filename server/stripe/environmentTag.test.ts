/**
 * THE ENVIRONMENT TAG, PROVED AT THE WIRE AND AT THE DOOR (L6).
 *
 * L8b's lesson, one lane over and while it is fresh: mint, refine and headshot
 * could each lose their resource lock with 6,777 tests green, because the guard
 * was real and nothing failed when it was deleted. So this file does not test
 * that the tag exists — it tests that money DOES NOT MOVE when the tag says
 * another world, and it derives the writer half from the tree so a Stripe call
 * written tomorrow is in scope the moment it exists.
 *
 * Sabotage record (2026-08-17, each arm a full `pnpm test` run):
 *   positive  delete the guard call in webhooks.ts       -> this file reddens
 *   positive  drop `...environmentMetadata()` from the
 *             checkout session's metadata                -> this file reddens
 *   negative  blind the source scanner (zero files)      -> it REFUSES rather
 *                                                          than passing empty
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── the doubles the webhook entry point needs ────────────────────────────────
vi.mock("./stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(0),
  getMonthlyCredits: vi.fn().mockReturnValue(100),
  cancelSubscription: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue(undefined),
  getUserByStripeCustomerId: vi.fn().mockResolvedValue(null),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 100 }),
  getUserCredits: vi.fn().mockResolvedValue({ balance: 100 }),
  suspendUser: vi.fn().mockResolvedValue({ success: true }),
  unsuspendUser: vi.fn().mockResolvedValue({ success: true }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 0 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
  creditReferrerOnPaidAction: vi.fn().mockResolvedValue(true),
}));

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    chargebackFiled: vi.fn().mockResolvedValue(true),
    chargebackResolved: vi.fn().mockResolvedValue(true),
    paymentFailed: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) }),
    }),
  }),
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { creditReferrerOnPaidAction, updateUserSubscription } from "../db";
import {
  ENV_TAG_KEY,
  TAGGED_EVENT_TYPES,
  UNTAGGED_REFUSAL,
  checkEventEnvironment,
  environmentMetadata,
} from "./environmentTag";
import { deploymentTag } from "../_core/env";
import type Stripe from "stripe";

const THIS_WORLD_IS = "railway:production";
const OTHER_WORLD = "local";

function makeEvent(type: string, object: any): Stripe.Event {
  return {
    id: `evt_${type}_${Math.floor(Math.random() * 1e9)}`,
    type,
    data: { object },
    object: "event",
    api_version: "2023-10-16",
    created: 1_700_000_000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

let savedRailway: string | undefined;
let savedRailwayName: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedRailway = process.env.RAILWAY_ENVIRONMENT;
  savedRailwayName = process.env.RAILWAY_ENVIRONMENT_NAME;
  // Drive this process as if it were the production deployment.
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  delete process.env.RAILWAY_ENVIRONMENT;
});

afterEach(() => {
  if (savedRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
  else process.env.RAILWAY_ENVIRONMENT = savedRailway;
  if (savedRailwayName === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
  else process.env.RAILWAY_ENVIRONMENT_NAME = savedRailwayName;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE TAG ITSELF — derived, and it discriminates
// ═══════════════════════════════════════════════════════════════════════════
describe("the deployment tag", () => {
  it("names the Railway environment when the platform injected one", () => {
    expect(deploymentTag()).toBe(THIS_WORLD_IS);
    expect(environmentMetadata()).toEqual({ [ENV_TAG_KEY]: THIS_WORLD_IS });
  });

  it("reads `local` on a laptop — the two worlds are DIFFERENT strings", () => {
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_ENVIRONMENT;
    const wasNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      expect(deploymentTag()).toBe(OTHER_WORLD);
      expect(deploymentTag()).not.toBe(THIS_WORLD_IS);
    } finally {
      if (wasNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = wasNodeEnv;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE DOOR — money must not move on a foreign event
//
//    This is the assertion L8b found missing on the casting money path:
//    not "the check exists" but "nothing was charged".
// ═══════════════════════════════════════════════════════════════════════════
describe("the webhook refuses another world's events BEFORE any money moves", () => {
  it("a foreign checkout.session.completed pays NOBODY", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_foreign",
      metadata: { userId: "1", type: "subscription", [ENV_TAG_KEY]: OTHER_WORLD },
    });
    vi.mocked(constructWebhookEvent).mockReturnValue(event);

    const result = await handleStripeWebhook("payload", "sig");

    // The referral bonus is REFERRAL_REWARD_CREDITS = 12,500 credits, paid to
    // the named user's referrer. It is the one money line reachable from
    // metadata.userId, and it must not have been reached.
    expect(creditReferrerOnPaidAction).not.toHaveBeenCalled();
    expect(result.refused).toBe(true);
    expect(result.message).toContain("foreign-environment");
    expect(result.message).toContain(OTHER_WORLD);
    // ACK, not 400: a foreign event will never succeed, and retries would
    // eventually get the production endpoint disabled.
    expect(result.success).toBe(true);
  });

  it("a foreign subscription event changes NO plan tier", async () => {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_test_foreign",
      customer: "cus_test_foreign",
      status: "active",
      metadata: { userId: "1", plan: "pro", [ENV_TAG_KEY]: OTHER_WORLD },
    });
    vi.mocked(constructWebhookEvent).mockReturnValue(event);

    const result = await handleStripeWebhook("payload", "sig");

    expect(updateUserSubscription).not.toHaveBeenCalled();
    expect(result.refused).toBe(true);
  });

  it("THIS world's checkout is fulfilled — the guard is not simply a wall", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_ours",
      metadata: { userId: "1", type: "subscription", [ENV_TAG_KEY]: THIS_WORLD_IS },
    });
    vi.mocked(constructWebhookEvent).mockReturnValue(event);

    const result = await handleStripeWebhook("payload", "sig");

    expect(creditReferrerOnPaidAction).toHaveBeenCalledWith(1);
    expect(result.refused).toBeUndefined();
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. UNTAGGED — its own arm, and its refusal NAMES ITSELF (fable-821 §2c)
// ═══════════════════════════════════════════════════════════════════════════
describe("an untagged object is refused, loudly and by name", () => {
  it("refuses a session with no metadata at all, and pays nobody", async () => {
    const event = makeEvent("checkout.session.completed", { id: "cs_test_bare" });
    vi.mocked(constructWebhookEvent).mockReturnValue(event);

    const result = await handleStripeWebhook("payload", "sig");

    expect(creditReferrerOnPaidAction).not.toHaveBeenCalled();
    expect(result.refused).toBe(true);
    expect(result.message).toBe(UNTAGGED_REFUSAL);
  });

  it("refuses a session whose metadata has everything BUT the tag", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_test_untagged",
      metadata: { userId: "1", plan: "pro", type: "subscription" },
    });
    vi.mocked(constructWebhookEvent).mockReturnValue(event);

    const result = await handleStripeWebhook("payload", "sig");

    expect(creditReferrerOnPaidAction).not.toHaveBeenCalled();
    expect(result.message).toBe(UNTAGGED_REFUSAL);
  });

  it("the refusal tells a human what to do about a dashboard-created object", () => {
    // A Stripe object made by hand in the dashboard is untagged by
    // construction. That is a legitimate action, so the message must name
    // itself rather than reading as a swallow.
    expect(UNTAGGED_REFUSAL).toContain("dashboard-created");
    expect(UNTAGGED_REFUSAL).toContain(`metadata.${ENV_TAG_KEY}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. THE DECLARED BOUND — invoices and disputes are OUT of scope, on purpose
//
//    They are authored by Stripe and by banks and carry no metadata of ours.
//    Their world check is the local customer lookup. This test exists so the
//    bound is a decision with a name, not an omission somebody rediscovers.
// ═══════════════════════════════════════════════════════════════════════════
describe("the bound is declared, not silent", () => {
  it("passes invoice and dispute events through untouched", () => {
    for (const type of [
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "charge.dispute.created",
      "charge.dispute.closed",
    ]) {
      expect(TAGGED_EVENT_TYPES.has(type)).toBe(false);
      expect(checkEventEnvironment(makeEvent(type, { id: "x" }))).toEqual({ accepted: true });
    }
  });

  it("covers every event type whose object this codebase stamps", () => {
    expect([...TAGGED_EVENT_TYPES].sort()).toEqual([
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. THE WRITERS — derived from the TREE, so a Stripe call written tomorrow
//    is in scope the moment it exists (working law 4: no second list).
// ═══════════════════════════════════════════════════════════════════════════
describe("every metadata block we send to Stripe carries the tag", () => {
  const STRIPE_DIR = join(process.cwd(), "server", "stripe");

  /** Every non-test source file under server/stripe. */
  function sourceFiles(): string[] {
    return readdirSync(STRIPE_DIR)
      .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
      .map((f) => join(STRIPE_DIR, f));
  }

  /** The balanced-brace block that follows a `metadata:` / `metadata =`. */
  function metadataBlocks(source: string): string[] {
    const blocks: string[] = [];
    const marker = /\bmetadata\s*[:=]\s*\{/g;
    let hit: RegExpExecArray | null;
    while ((hit = marker.exec(source)) !== null) {
      let depth = 1;
      let i = hit.index + hit[0].length;
      while (i < source.length && depth > 0) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") depth--;
        i++;
      }
      blocks.push(source.slice(hit.index, i));
    }
    return blocks;
  }

  it("finds the writers at all — negative control on a blind scanner", () => {
    const files = sourceFiles();
    // If the scan finds nothing it must FAIL, not pass vacuously. This is the
    // direction that actually kills checkers.
    expect(files.length).toBeGreaterThanOrEqual(3);
    const totalBlocks = files
      .map((f) => metadataBlocks(readFileSync(f, "utf8")).length)
      .reduce((a, b) => a + b, 0);
    expect(totalBlocks).toBeGreaterThanOrEqual(5);
  });

  it("every one of them spreads environmentMetadata()", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      // environmentTag.ts is where the tag is DEFINED; its own literal is the
      // definition, not a writer.
      if (file.endsWith("environmentTag.ts")) continue;
      for (const block of metadataBlocks(source)) {
        if (!block.includes("environmentMetadata()")) {
          offenders.push(`${file.replace(process.cwd(), "")} :: ${block.slice(0, 90).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
