import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestApproval,
  getApprovalStatus,
  approveAction,
  denyAction,
  markExecuted,
  markFailed,
  _clearPendingActions,
  type ApprovalAction,
} from "./slackApproval";

// Mock the Slack dispatcher module (slackApproval now imports from slackDispatcher)
vi.mock("./slackDispatcher", () => ({
  sendRawToChannel: vi.fn().mockResolvedValue(true),
  dispatchAuditLog: vi.fn().mockResolvedValue(true),
}));

// Mock fetch for Slack webhook calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("ok"),
});
vi.stubGlobal("fetch", mockFetch);

describe("Slack Approval Flow", () => {
  beforeEach(() => {
    _clearPendingActions();
    vi.clearAllMocks();
    // Set webhook URL so Slack messages are sent (not auto-approved)
    process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL = "https://hooks.slack.com/test-admin-actions";
  });

  describe("requestApproval", () => {
    it("should create a pending action and return an action ID", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin One", email: "admin@test.com" },
        targetId: "42",
        description: "Suspend user 42 for abuse",
        params: { reason: "Abuse detected" },
      });

      expect(result.actionId).toBeDefined();
      expect(typeof result.actionId).toBe("string");
      expect(result.actionId.length).toBe(32); // 16 bytes hex
      expect(result.sent).toBe(true);
    });

    it("should send approval request to admin-actions channel", async () => {
      const { sendRawToChannel } = await import("./slackDispatcher");
      
      await requestApproval({
        action: "blockIP",
        requestedBy: { id: 1, name: "Admin One" },
        targetId: "192.168.1.100",
        description: "Block suspicious IP",
        params: { reason: "Brute force" },
      });

      // Verify sendRawToChannel was called with "admin-actions"
      expect(sendRawToChannel).toHaveBeenCalledWith(
        "admin-actions",
        expect.objectContaining({
          text: expect.stringContaining("Admin Action"),
          blocks: expect.any(Array),
        }),
        expect.objectContaining({ skipDedup: true })
      );
    });

    it("should auto-approve when admin-actions webhook is not configured", async () => {
      delete process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL;

      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin One" },
        targetId: "42",
        description: "Suspend user",
        params: {},
      });

      expect(result.sent).toBe(false);

      // Action should be auto-approved
      const status = getApprovalStatus(result.actionId);
      expect(status).not.toBeNull();
      expect(status!.status).toBe("approved");
      expect(status!.resolvedBy).toContain("Slack not configured");
    });

    it("should store the pending action with correct details", async () => {
      const result = await requestApproval({
        action: "adjustCredits",
        requestedBy: { id: 5, name: "Admin Five", email: "five@test.com" },
        targetId: "100",
        description: "Add 500 credits for compensation",
        params: { amount: 500, reason: "Compensation" },
        ipAddress: "10.0.0.1",
      });

      const status = getApprovalStatus(result.actionId);
      expect(status).not.toBeNull();
      expect(status!.action).toBe("adjustCredits");
      expect(status!.requestedBy.id).toBe(5);
      expect(status!.requestedBy.name).toBe("Admin Five");
      expect(status!.targetId).toBe("100");
      expect(status!.description).toBe("Add 500 credits for compensation");
      expect(status!.params).toEqual({ amount: 500, reason: "Compensation" });
      expect(status!.ipAddress).toBe("10.0.0.1");
      expect(status!.status).toBe("pending");
    });

    it("should set expiry to 5 minutes from creation", async () => {
      const before = Date.now();
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });
      const after = Date.now();

      const status = getApprovalStatus(result.actionId);
      expect(status!.expiresAt).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
      expect(status!.expiresAt).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    });


  });

  describe("getApprovalStatus", () => {
    it("should return null for non-existent action", () => {
      const status = getApprovalStatus("nonexistent");
      expect(status).toBeNull();
    });

    it("should return the pending action details", async () => {
      const result = await requestApproval({
        action: "unblockIP",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "10.0.0.1",
        description: "Unblock IP",
        params: {},
      });

      const status = getApprovalStatus(result.actionId);
      expect(status).not.toBeNull();
      expect(status!.id).toBe(result.actionId);
      expect(status!.action).toBe("unblockIP");
    });

    it("should mark expired actions when checked", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      // Manually set expiry to the past
      const action = getApprovalStatus(result.actionId);
      action!.expiresAt = Date.now() - 1000;

      const status = getApprovalStatus(result.actionId);
      expect(status!.status).toBe("expired");
    });
  });

  describe("approveAction", () => {
    it("should approve a pending action", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin One" },
        targetId: "42",
        description: "Suspend user",
        params: {},
      });

      const approval = approveAction(result.actionId, "SlackUser (slackuser)");

      expect(approval.success).toBe(true);
      expect(approval.action).toBeDefined();
      expect(approval.action!.status).toBe("approved");
      expect(approval.action!.resolvedBy).toBe("SlackUser (slackuser)");
      expect(approval.action!.resolvedAt).toBeDefined();
    });

    it("should fail for non-existent action", () => {
      const result = approveAction("nonexistent", "SlackUser");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Action not found");
    });

    it("should fail for already approved action", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      approveAction(result.actionId, "SlackUser");
      const secondApproval = approveAction(result.actionId, "AnotherUser");

      expect(secondApproval.success).toBe(false);
      expect(secondApproval.error).toContain("already approved");
    });

    it("should fail for expired action", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      // Manually expire
      const action = getApprovalStatus(result.actionId);
      action!.expiresAt = Date.now() - 1000;

      const approval = approveAction(result.actionId, "SlackUser");
      expect(approval.success).toBe(false);
      expect(approval.error).toContain("expired");
    });
  });

  describe("denyAction", () => {
    it("should deny a pending action", async () => {
      const result = await requestApproval({
        action: "adjustCredits",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "100",
        description: "Adjust credits",
        params: { amount: 1000 },
      });

      const denial = denyAction(result.actionId, "SecurityAdmin (secadmin)");

      expect(denial.success).toBe(true);
      expect(denial.action).toBeDefined();
      expect(denial.action!.status).toBe("denied");
      expect(denial.action!.resolvedBy).toBe("SecurityAdmin (secadmin)");
    });

    it("should fail for non-existent action", () => {
      const result = denyAction("nonexistent", "SlackUser");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Action not found");
    });

    it("should fail for already denied action", async () => {
      const result = await requestApproval({
        action: "blockIP",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1.2.3.4",
        description: "test",
        params: {},
      });

      denyAction(result.actionId, "SlackUser");
      const secondDenial = denyAction(result.actionId, "AnotherUser");

      expect(secondDenial.success).toBe(false);
      expect(secondDenial.error).toContain("already denied");
    });

    it("should prevent approval after denial", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      denyAction(result.actionId, "SlackUser");
      const approval = approveAction(result.actionId, "AnotherUser");

      expect(approval.success).toBe(false);
    });
  });

  describe("markExecuted", () => {
    it("should mark an approved action as executed", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      approveAction(result.actionId, "SlackUser");
      markExecuted(result.actionId, "User suspended successfully");

      const status = getApprovalStatus(result.actionId);
      expect(status!.status).toBe("executed");
      expect(status!.resultMessage).toBe("User suspended successfully");
    });

    it("should not mark a pending action as executed", async () => {
      const result = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1",
        description: "test",
        params: {},
      });

      markExecuted(result.actionId, "Should not work");

      const status = getApprovalStatus(result.actionId);
      expect(status!.status).toBe("pending");
    });
  });

  describe("markFailed", () => {
    it("should mark an action as failed", async () => {
      const result = await requestApproval({
        action: "blockIP",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1.2.3.4",
        description: "test",
        params: {},
      });

      approveAction(result.actionId, "SlackUser");
      markFailed(result.actionId, "Database error");

      const status = getApprovalStatus(result.actionId);
      expect(status!.status).toBe("failed");
      expect(status!.resultMessage).toBe("Database error");
    });
  });

  describe("Full approval lifecycle", () => {
    it("should support the complete request -> approve -> execute flow", async () => {
      // Step 1: Admin requests approval
      const { actionId } = await requestApproval({
        action: "suspendUser",
        requestedBy: { id: 1, name: "Admin One", email: "admin@test.com" },
        targetId: "42",
        description: "Suspend user 42 for repeated TOS violations",
        params: { reason: "TOS violation" },
        ipAddress: "10.0.0.1",
      });

      // Step 2: Verify it's pending
      let status = getApprovalStatus(actionId);
      expect(status!.status).toBe("pending");

      // Step 3: Slack user approves
      const approval = approveAction(actionId, "SecurityLead (seclead)");
      expect(approval.success).toBe(true);

      // Step 4: Verify it's approved
      status = getApprovalStatus(actionId);
      expect(status!.status).toBe("approved");
      expect(status!.resolvedBy).toBe("SecurityLead (seclead)");

      // Step 5: Execute and mark as done
      markExecuted(actionId, "User 42 suspended successfully");

      // Step 6: Verify final state
      status = getApprovalStatus(actionId);
      expect(status!.status).toBe("executed");
      expect(status!.resultMessage).toBe("User 42 suspended successfully");
    });

    it("should support the complete request -> deny flow", async () => {
      const { actionId } = await requestApproval({
        action: "adjustCredits",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "100",
        description: "Add 10000 credits",
        params: { amount: 10000 },
      });

      // Deny the action
      const denial = denyAction(actionId, "CFO (cfo)");
      expect(denial.success).toBe(true);

      const status = getApprovalStatus(actionId);
      expect(status!.status).toBe("denied");
      expect(status!.resolvedBy).toBe("CFO (cfo)");
    });

    it("should support the complete request -> expire flow", async () => {
      const { actionId } = await requestApproval({
        action: "blockIP",
        requestedBy: { id: 1, name: "Admin" },
        targetId: "1.2.3.4",
        description: "Block IP",
        params: {},
      });

      // Manually expire
      const action = getApprovalStatus(actionId);
      action!.expiresAt = Date.now() - 1000;

      // Check status triggers expiry detection
      const status = getApprovalStatus(actionId);
      expect(status!.status).toBe("expired");

      // Cannot approve expired action
      const approval = approveAction(actionId, "SlackUser");
      expect(approval.success).toBe(false);
    });
  });

  describe("All supported action types", () => {
    const actionTypes: ApprovalAction[] = [
      "suspendUser",
      "unsuspendUser",
      "adjustCredits",
      "blockIP",
      "unblockIP",
    ];

    for (const actionType of actionTypes) {
      it(`should handle ${actionType} action type`, async () => {
        const result = await requestApproval({
          action: actionType,
          requestedBy: { id: 1, name: "Admin" },
          targetId: "test-target",
          description: `Test ${actionType}`,
          params: {},
        });

        expect(result.actionId).toBeDefined();
        const status = getApprovalStatus(result.actionId);
        expect(status!.action).toBe(actionType);
      });
    }
  });
});
