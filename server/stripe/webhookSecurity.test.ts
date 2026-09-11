import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock all external dependencies before imports
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
  addCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 75 }),
  getCreditTransactionByRef: vi.fn().mockResolvedValue(null),
}));

vi.mock("../slack/slackNotification", () => ({
  SlackAlerts: {
    chargebackFiled: vi.fn().mockResolvedValue(true),
    chargebackResolved: vi.fn().mockResolvedValue(true),
  },
}));

// Mock database connection for idempotency checks. The double RECORDS what
// the handler asks it to record (the shape PR #786 round 2 established): a
// redelivery arm must be able to see that a FAILED event was NOT marked
// processed, or it drives a road production cannot take.
const processedEventInserts = vi.hoisted(() => [] as Array<{ eventId: string; eventType: string }>);
vi.mock("../db/connection", () => ({
  getDb: vi.fn().mockImplementation(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }), // No existing events (not a duplicate)
    insert: () => ({
      values: (row: { eventId: string; eventType: string }) => ({
        onDuplicateKeyUpdate: async () => {
          processedEventInserts.push(row);
        },
      }),
    }),
  })),
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { cancelSubscription } from "./stripeService";
import {
  getUserByStripeCustomerId,
  suspendUser,
  unsuspendUser,
  deductCredits,
  addCredits,
  getCreditTransactionByRef,
} from "../db";
import { SlackAlerts } from "../slack/slackNotification";
import type Stripe from "stripe";

function makeEvent(type: string, data: any): Stripe.Event {
  return {
    id: `evt_mock_${Date.now()}`,
    type,
    data: { object: data },
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

const mockUser = {
  id: 42,
  name: "John Doe",
  email: "john@example.com",
  openId: "test-open-id",
  loginMethod: "manus",
  approved: true,
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  credits: {
    balance: 75,
    stripeCustomerId: "cus_test_user42",
    stripeSubscriptionId: "sub_test_abc123",
  },
};

describe("Webhook Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processedEventInserts.length = 0;
  });

  // ============================================================
  // DISPUTE CREATED — AUTO-SUSPEND + REVOKE CREDITS
  // ============================================================
  describe("Chargeback: dispute.created — Auto-suspend + Revoke Credits", () => {
    it("should suspend user and revoke all credits when dispute is filed", async () => {
      const dispute = {
        id: "dp_test_suspend",
        charge: "ch_test_xyz",
        amount: 5000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "needs_response",
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("suspended");
      expect(result.message).toContain("75 credits revoked");

      // Verify user was suspended with correct reason
      expect(suspendUser).toHaveBeenCalledWith(
        42,
        expect.stringContaining("Chargeback filed: dp_test_suspend"),
        0 // system action
      );

      // Verify credits were revoked (entire balance of 75). The revoke is the
      // product's one deliberate `toolKind: null` — it makes nothing (#401) —
      // and this wire assertion is what keeps that stated rather than drifted.
      expect(deductCredits).toHaveBeenCalledWith(
        42,
        75,
        "refund",
        expect.stringContaining("Credits frozen: chargeback dp_test_suspend"),
        "dispute_dp_test_suspend",
        { toolKind: null }
      );

      // Verify Slack alert was sent
      expect(SlackAlerts.chargebackFiled).toHaveBeenCalledWith(
        "dp_test_suspend",
        "ch_test_xyz",
        5000,
        "usd",
        "fraudulent",
        42,
        "John Doe"
      );
    });

    it("should handle user with zero credits (no deduction needed)", async () => {
      const dispute = {
        id: "dp_test_zero_credits",
        charge: "ch_test_zero",
        amount: 2500,
        currency: "usd",
        reason: "product_not_received",
        customer: "cus_test_zero",
        status: "needs_response",
      };

      const userWithZeroCredits = {
        ...mockUser,
        credits: { ...mockUser.credits, balance: 0 },
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(userWithZeroCredits as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      // User should still be suspended
      expect(suspendUser).toHaveBeenCalled();
      // But no credit deduction
      expect(deductCredits).not.toHaveBeenCalled();
    });

    it("should send Slack alert even when user is not identified", async () => {
      const dispute = {
        id: "dp_test_unknown_user",
        charge: "ch_test_unknown",
        amount: 3000,
        currency: "eur",
        reason: "general",
        status: "needs_response",
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      // No customer field → user not identified

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("not identified");
      expect(SlackAlerts.chargebackFiled).toHaveBeenCalled();
      expect(suspendUser).not.toHaveBeenCalled();
      expect(deductCredits).not.toHaveBeenCalled();
    });

    it("should handle suspend failure gracefully", async () => {
      const dispute = {
        id: "dp_test_suspend_fail",
        charge: "ch_test_sf",
        amount: 1000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "needs_response",
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      vi.mocked(suspendUser).mockResolvedValue({ success: false, error: "DB error" });

      const result = await handleStripeWebhook("payload", "sig");

      // Should still succeed (webhook processed) even if suspend failed
      expect(result.success).toBe(true);
      // Credits should still be revoked even if suspend failed
      expect(deductCredits).toHaveBeenCalled();
    });
  });

  // ============================================================
  // DISPUTE CLOSED (WON) — RESTORE ACCOUNT + CREDITS
  // ============================================================
  describe("Chargeback: dispute.closed (won) — Restore Account + Credits", () => {
    it("should unsuspend user and restore credits when dispute is won", async () => {
      const dispute = {
        id: "dp_test_won",
        charge: "ch_test_won",
        amount: 5000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      // The revoke transaction from dispute.created
      vi.mocked(getCreditTransactionByRef).mockResolvedValue({
        id: 999,
        userId: 42,
        amount: -75, // negative = deduction
        type: "refund",
        description: "Credits frozen: chargeback dp_test_won",
        referenceId: "dispute_dp_test_won",
        balanceAfter: 0,
        createdAt: new Date(),
        engineUsed: null,
      } as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("account restored");
      expect(result.message).toContain("75 credits restored");

      // Verify unsuspend
      expect(unsuspendUser).toHaveBeenCalledWith(42);

      // Verify credits restored with idempotent referenceId
      expect(addCredits).toHaveBeenCalledWith(
        42,
        75,
        "refund",
        expect.stringContaining("Credits restored: dispute dp_test_won won"),
        "dispute_restore_dp_test_won"
      );

      // Verify Slack alert
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledWith(
        "dp_test_won",
        "ch_test_won",
        5000,
        "usd",
        "won",
        42,
        "John Doe"
      );
    });

    it("should handle duplicate restore (idempotency)", async () => {
      const dispute = {
        id: "dp_test_dup_restore",
        charge: "ch_test_dup",
        amount: 2500,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      vi.mocked(getCreditTransactionByRef).mockResolvedValue({
        id: 999,
        userId: 42,
        amount: -75,
        type: "refund",
        referenceId: "dispute_dp_test_dup_restore",
      } as any);
      // addCredits returns duplicate
      vi.mocked(addCredits).mockResolvedValue({ success: true, newBalance: 75, duplicate: true });

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("credits already restored (duplicate)");
    });

    it("should handle case where no revoke transaction is found", async () => {
      const dispute = {
        id: "dp_test_no_revoke",
        charge: "ch_test_nr",
        amount: 1000,
        currency: "usd",
        reason: "general",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      vi.mocked(getCreditTransactionByRef).mockResolvedValue(null);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("no revoked credits found to restore");
      // Should still unsuspend
      expect(unsuspendUser).toHaveBeenCalledWith(42);
      // Should NOT try to add credits
      expect(addCredits).not.toHaveBeenCalled();
    });

    /*
      #789 (PR #787's round-2 class on this road): `addCredits` catches its
      own errors and returns `{ success: false }`; the handler logged it,
      pushed "credit restore failed" into its actions and still returned
      success — ACKed 200, recorded, never redelivered. A customer who WON
      stayed without their credits. The restore is idempotent on its ledger
      ref, so Stripe's redelivery is the retry — and the arm drives the SAME
      event id twice, with the first delivery recorded as NOT processed.
    */
    it("a failed credit restore on a WON dispute FAILS THE EVENT after the unsuspend, and the SAME event redelivered restores (#789)", async () => {
      const dispute = {
        id: "dp_test_restore_blip",
        charge: "ch_test_rb",
        amount: 5000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      vi.mocked(getCreditTransactionByRef).mockResolvedValue({
        id: 999,
        userId: 42,
        amount: -75,
        type: "refund",
        referenceId: "dispute_dp_test_restore_blip",
      } as any);
      vi.mocked(addCredits).mockResolvedValueOnce({ success: false, error: "deadlock" } as any);

      /* First delivery: the ledger blips. The event FAILS — that is what
         makes Stripe send it again — but the account is already restored. */
      const first = await handleStripeWebhook("payload", "sig");
      expect(first.success).toBe(false);
      expect(first.message).toContain("credit restore failed");
      expect(first.message).toContain("redelivers");
      expect(unsuspendUser).toHaveBeenCalledWith(42);
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledTimes(1);
      expect(processedEventInserts).toHaveLength(0);

      /* Redelivery of the SAME event id: the restore lands on its idempotent
         ref and the event is recorded once. */
      vi.mocked(addCredits).mockResolvedValueOnce({ success: true, newBalance: 75 } as any);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      const second = await handleStripeWebhook("payload", "sig");
      expect(second.success).toBe(true);
      expect(second.message).toContain("75 credits restored");
      expect(addCredits).toHaveBeenCalledTimes(2);
      expect(addCredits).toHaveBeenLastCalledWith(
        42,
        75,
        "refund",
        expect.stringContaining("Credits restored: dispute dp_test_restore_blip won"),
        "dispute_restore_dp_test_restore_blip"
      );
      expect(processedEventInserts).toHaveLength(1);
      expect(processedEventInserts[0].eventId).toBe(event.id);
    });

    /*
      The other half of #789: `getCreditTransactionByRef` answered `null`
      for BOTH "no such row" and "database unavailable", and this handler
      read it as the first — a delivery in a no-db window ACKed a real
      deduction as "nothing to restore". It THROWS now, and the webhook's
      outer catch turns that into a failed event, so Stripe redelivers.
    */
    it("a database that cannot be read on a WON dispute FAILS THE EVENT rather than answering 'nothing to restore' (#789)", async () => {
      const dispute = {
        id: "dp_test_no_db",
        charge: "ch_test_nodb",
        amount: 1000,
        currency: "usd",
        reason: "general",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);
      vi.mocked(getCreditTransactionByRef).mockRejectedValue(new Error("Database not available"));

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(false);
      expect(result.message).not.toContain("no revoked credits found to restore");
      expect(addCredits).not.toHaveBeenCalled();
      expect(processedEventInserts).toHaveLength(0);
    });
  });

  // ============================================================
  // DISPUTE CLOSED (LOST) — KEEP SUSPENDED + CANCEL SUBSCRIPTION
  // ============================================================
  describe("Chargeback: dispute.closed (lost) — Finalize Suspension", () => {
    it("should keep user suspended and cancel subscription when dispute is lost", async () => {
      const dispute = {
        id: "dp_test_lost",
        charge: "ch_test_lost",
        amount: 5000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "lost",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("account remains suspended");
      expect(result.message).toContain("subscription cancelled");

      // Should NOT unsuspend
      expect(unsuspendUser).not.toHaveBeenCalled();

      // Should cancel Stripe subscription
      expect(cancelSubscription).toHaveBeenCalledWith("sub_test_abc123");

      // Verify Slack alert
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledWith(
        "dp_test_lost",
        "ch_test_lost",
        5000,
        "usd",
        "lost",
        42,
        "John Doe"
      );
    });

    it("should handle lost dispute with no active subscription", async () => {
      const dispute = {
        id: "dp_test_lost_nosub",
        charge: "ch_test_nosub",
        amount: 2500,
        currency: "usd",
        reason: "product_not_received",
        customer: "cus_test_nosub",
        status: "lost",
      };

      const userNoSub = {
        ...mockUser,
        credits: { ...mockUser.credits, stripeSubscriptionId: null },
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(userNoSub as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("account remains suspended");
      expect(result.message).toContain("no active subscription");
      expect(cancelSubscription).not.toHaveBeenCalled();
    });

    it("should handle lost dispute with unknown user", async () => {
      const dispute = {
        id: "dp_test_lost_unknown",
        charge: "ch_test_lost_unknown",
        amount: 10000,
        currency: "gbp",
        reason: "fraudulent",
        customer: "cus_test_gone",
        status: "lost",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("user not identified");
      expect(unsuspendUser).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // DISPUTE CLOSED (OTHER STATUSES)
  // ============================================================
  describe("Chargeback: dispute.closed (other statuses)", () => {
    it("should not take automatic action on warning_closed status", async () => {
      const dispute = {
        id: "dp_test_warning",
        charge: "ch_test_warning",
        amount: 1500,
        currency: "usd",
        reason: "general",
        customer: "cus_test_user42",
        status: "warning_closed",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(mockUser as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("no automatic action taken");
      expect(unsuspendUser).not.toHaveBeenCalled();
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(addCredits).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ============================================================
  describe("Webhook Signature Verification", () => {
    it("should reject invalid signatures", async () => {
      vi.mocked(constructWebhookEvent).mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const result = await handleStripeWebhook("bad-payload", "bad-sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid signature");
    });
  });

  // ============================================================
  // UNHANDLED EVENT TYPES
  // ============================================================
  describe("Unhandled Event Types", () => {
    it("should gracefully handle unknown event types", async () => {
      const event = makeEvent("some.unknown.event", {});
      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Unhandled event type");
    });
  });
});
