import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock all external dependencies before imports
vi.mock("./stripeService", () => ({
  constructWebhookEvent: vi.fn(),
  mapStripeStatus: vi.fn().mockReturnValue("active"),
  mapPlanToTier: vi.fn().mockReturnValue("pro"),
  calculateRolloverCredits: vi.fn().mockReturnValue(0),
  getMonthlyCredits: vi.fn().mockReturnValue(100),
}));

vi.mock("./db", () => ({
  updateUserSubscription: vi.fn().mockResolvedValue(undefined),
  getUserByStripeCustomerId: vi.fn().mockResolvedValue(null),
  refreshMonthlyCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 100 }),
  addTopupCredits: vi.fn().mockResolvedValue({ success: true, newBalance: 150 }),
  getUserCredits: vi.fn().mockResolvedValue({ balance: 100 }),
}));

vi.mock("./slackNotification", () => ({
  SlackAlerts: {
    chargebackFiled: vi.fn().mockResolvedValue(true),
    chargebackResolved: vi.fn().mockResolvedValue(true),
  },
}));

import { handleStripeWebhook } from "./webhooks";
import { constructWebhookEvent } from "./stripeService";
import { addTopupCredits, getUserByStripeCustomerId } from "./db";
import { SlackAlerts } from "./slackNotification";
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
      // addTopupCredits returns duplicate: true when the referenceId already exists
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
          // missing packageId and credits
        },
      };

      const event = makeEvent("checkout.session.completed", session);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Missing package info");
      expect(addTopupCredits).not.toHaveBeenCalled();
    });

    it("should handle test events with evt_test_ prefix", async () => {
      const event = {
        id: "evt_test_webhook_verification",
        type: "checkout.session.completed",
        data: { object: {} },
        object: "event",
        api_version: "2023-10-16",
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: null,
      } as unknown as Stripe.Event;

      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      // The test event should still be processed through the normal flow
      // (test event handling is done at the Express route level, not in handleStripeWebhook)
      const result = await handleStripeWebhook("payload", "sig");
      // It will fail because metadata is missing, which is expected for test events
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // CHARGEBACK / DISPUTE HANDLER TESTS
  // ============================================================
  describe("Chargeback Handler (charge.dispute.created)", () => {
    it("should send Slack alert when dispute is filed with known user", async () => {
      const dispute = {
        id: "dp_test_abc123",
        charge: "ch_test_xyz789",
        amount: 2500,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        payment_intent: "pi_test_123",
        status: "needs_response",
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 42,
        name: "John Doe",
        email: "john@example.com",
        openId: "test-open-id",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        credits: null,
      } as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dispute dp_test_abc123 filed");
      expect(result.message).toContain("Slack alert sent");
      expect(SlackAlerts.chargebackFiled).toHaveBeenCalledWith(
        "dp_test_abc123",
        "ch_test_xyz789",
        2500,
        "usd",
        "fraudulent",
        42,
        "John Doe"
      );
    });

    it("should send Slack alert when dispute is filed with unknown user", async () => {
      const dispute = {
        id: "dp_test_unknown",
        charge: "ch_test_unknown",
        amount: 5000,
        currency: "usd",
        reason: "product_not_received",
        customer: "cus_test_unknown",
        status: "needs_response",
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(SlackAlerts.chargebackFiled).toHaveBeenCalledWith(
        "dp_test_unknown",
        "ch_test_unknown",
        5000,
        "usd",
        "product_not_received",
        undefined,
        undefined
      );
    });

    it("should handle dispute with no customer field", async () => {
      const dispute = {
        id: "dp_test_no_customer",
        charge: "ch_test_nocust",
        amount: 1000,
        currency: "eur",
        reason: "general",
        status: "needs_response",
        // no customer field
      };

      const event = makeEvent("charge.dispute.created", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(SlackAlerts.chargebackFiled).toHaveBeenCalledWith(
        "dp_test_no_customer",
        "ch_test_nocust",
        1000,
        "eur",
        "general",
        undefined,
        undefined
      );
      // Should not attempt to look up user
      expect(getUserByStripeCustomerId).not.toHaveBeenCalled();
    });
  });

  describe("Chargeback Handler (charge.dispute.closed)", () => {
    it("should send Slack alert when dispute is won", async () => {
      const dispute = {
        id: "dp_test_won",
        charge: "ch_test_won",
        amount: 2500,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user42",
        status: "won",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 42,
        name: "John Doe",
        email: "john@example.com",
      } as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Dispute dp_test_won closed (won)");
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledWith(
        "dp_test_won",
        "ch_test_won",
        2500,
        "usd",
        "won",
        42,
        "John Doe"
      );
    });

    it("should send critical Slack alert when dispute is lost", async () => {
      const dispute = {
        id: "dp_test_lost",
        charge: "ch_test_lost",
        amount: 10000,
        currency: "usd",
        reason: "fraudulent",
        customer: "cus_test_user99",
        status: "lost",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue({
        id: 99,
        name: "Jane Smith",
        email: "jane@example.com",
      } as any);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(result.message).toContain("lost");
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledWith(
        "dp_test_lost",
        "ch_test_lost",
        10000,
        "usd",
        "lost",
        99,
        "Jane Smith"
      );
    });

    it("should handle dispute closed with unknown user", async () => {
      const dispute = {
        id: "dp_test_closed_unknown",
        charge: "ch_test_closed_unknown",
        amount: 3000,
        currency: "gbp",
        reason: "subscription_canceled",
        customer: "cus_test_gone",
        status: "lost",
      };

      const event = makeEvent("charge.dispute.closed", dispute);
      vi.mocked(constructWebhookEvent).mockReturnValue(event);
      vi.mocked(getUserByStripeCustomerId).mockResolvedValue(null);

      const result = await handleStripeWebhook("payload", "sig");

      expect(result.success).toBe(true);
      expect(SlackAlerts.chargebackResolved).toHaveBeenCalledWith(
        "dp_test_closed_unknown",
        "ch_test_closed_unknown",
        3000,
        "gbp",
        "lost",
        undefined,
        undefined
      );
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
