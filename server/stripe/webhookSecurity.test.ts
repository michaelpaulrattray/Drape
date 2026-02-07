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
  addTopupCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 150 }),
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

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { cancelSubscription } from "./stripeService";
import {
  addTopupCredits,
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
    id: `evt_test_${Date.now()}`,
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
  });

  // ============================================================
  // IDEMPOTENCY TESTS
  // ============================================================
  describe("Webhook Idempotency (checkout.session.completed)", () => {
    it("should add credits on first topup checkout", async () => {
      const session = {
        id: "cs_test_unique_123",
        metadata: {
          userId: "42",
          type: "topup",
          packageId: "starter_pack",
          credits: "50",
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(addTopupCredits).mockResolvedValue({ success: true, newBalance: 150 });

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Added 50 credits");
      expect(addTopupCredits).toHaveBeenCalledWith(42, 50, "cs_test_unique_123");
    });

    it("should detect duplicate topup and skip credit grant", async () => {
      const session = {
        id: "cs_test_duplicate_456",
        metadata: {
          userId: "42",
          type: "topup",
          packageId: "starter_pack",
          credits: "50",
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(addTopupCredits).mockResolvedValue({
        success: true,
        newBalance: 150,
        duplicate: true,
      });

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Duplicate session");
      expect(result.message).toContain("credits already granted");
      expect(addTopupCredits).toHaveBeenCalledTimes(1);
    });

    it("should handle addTopupCredits failure gracefully", async () => {
      const session = {
        id: "cs_test_fail_789",
        metadata: {
          userId: "42",
          type: "topup",
          packageId: "starter_pack",
          credits: "50",
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(addTopupCredits).mockResolvedValue({
        success: false,
        error: "Database not available",
      });

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to add credits");
    });

    it("should reject topup with missing userId", async () => {
      const session = {
        id: "cs_test_no_user",
        metadata: {
          type: "topup",
          packageId: "starter_pack",
          credits: "50",
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Missing userId");
      expect(addTopupCredits).not.toHaveBeenCalled();
    });

    it("should reject topup with missing package info", async () => {
      const session = {
        id: "cs_test_no_pkg",
        metadata: {
          userId: "42",
          type: "topup",
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Missing package info");
      expect(addTopupCredits).not.toHaveBeenCalled();
    });
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

      // Verify credits were revoked (entire balance of 75)
      expect(deductCredits).toHaveBeenCalledWith(
        42,
        75,
        "refund",
        expect.stringContaining("Credits frozen: chargeback dp_test_suspend"),
        "dispute_dp_test_suspend"
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
