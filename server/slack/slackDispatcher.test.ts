import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import {
  dispatch,
  dispatchSecurityAlert,
  dispatchAdminAction,
  dispatchAuditLog,
  dispatchAdminActionWithAudit,
  sendRawToChannel,
  _clearDedupCache,
  getDedupCacheSize,
} from "./slackDispatcher";

// Mock fetch globally to prevent real Slack messages
const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

// These tests exercise routing/dedup logic with fetch mocked — no real Slack
// call is ever made — but the dispatcher resolves channel webhook URLs from
// env and silently drops channels without one. Provide dummies when the real
// vars are absent so the logic tests run on machines without Slack configured.
const WEBHOOK_VARS = [
  "SLACK_WEBHOOK_URL",
  "SLACK_ADMIN_ACTIONS_WEBHOOK_URL",
  "SLACK_AUDIT_LOG_WEBHOOK_URL",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const key of WEBHOOK_VARS) {
    originalEnv[key] = process.env[key];
    if (!process.env[key]) {
      process.env[key] = `https://hooks.slack.com/services/TEST/${key}`;
    }
  }
});

afterAll(() => {
  for (const key of WEBHOOK_VARS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

beforeEach(() => {
  _clearDedupCache();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve("ok"),
    status: 200,
  } as any);
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _clearDedupCache();
});

describe("SlackDispatcher - Deduplication", () => {
  it("should send the first message to a channel", async () => {
    const result = await dispatch({
      type: "admin_action_notification",
      title: "Test Action",
      description: "Test description",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(true);
    expect(result.channels).toContain("admin-actions");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should deduplicate identical messages within the time window", async () => {
    // First send
    await dispatch({
      type: "admin_action_notification",
      title: "Duplicate Test",
      description: "Same event",
      severity: "info",
      channels: ["admin-actions"],
    });

    // Second send (same title + type + channel) — should be deduped
    const result = await dispatch({
      type: "admin_action_notification",
      title: "Duplicate Test",
      description: "Same event again",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(false);
    expect(result.channels).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // Only the first call
  });

  it("should allow different titles to go through", async () => {
    await dispatch({
      type: "admin_action_notification",
      title: "Action A",
      description: "First",
      severity: "info",
      channels: ["admin-actions"],
    });

    const result = await dispatch({
      type: "admin_action_notification",
      title: "Action B",
      description: "Second",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should allow same title to different channels", async () => {
    await dispatch({
      type: "admin_action_notification",
      title: "Cross-Channel Test",
      description: "To admin",
      severity: "info",
      channels: ["admin-actions"],
    });

    const result = await dispatch({
      type: "audit_log_entry",
      title: "Cross-Channel Test",
      description: "To audit",
      severity: "info",
      channels: ["audit-log"],
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should skip dedup when skipDedup is true", async () => {
    await dispatch({
      type: "emergency_actions",
      title: "Emergency",
      description: "First",
      severity: "critical",
      channels: ["admin-actions"],
    });

    const result = await dispatch({
      type: "emergency_actions",
      title: "Emergency",
      description: "Second (forced)",
      severity: "critical",
      channels: ["admin-actions"],
      skipDedup: true,
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should track dedup cache size correctly", async () => {
    expect(getDedupCacheSize()).toBe(0);

    await dispatch({
      type: "admin_action_notification",
      title: "Event 1",
      description: "First",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(getDedupCacheSize()).toBe(1);

    await dispatch({
      type: "admin_action_notification",
      title: "Event 2",
      description: "Second",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(getDedupCacheSize()).toBe(2);

    // Duplicate should not increase cache size
    await dispatch({
      type: "admin_action_notification",
      title: "Event 1",
      description: "Duplicate",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(getDedupCacheSize()).toBe(2);
  });

  it("should clear dedup cache via _clearDedupCache", async () => {
    await dispatch({
      type: "admin_action_notification",
      title: "Clearable Event",
      description: "First",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(getDedupCacheSize()).toBe(1);
    _clearDedupCache();
    expect(getDedupCacheSize()).toBe(0);

    // Same event should now go through again
    const result = await dispatch({
      type: "admin_action_notification",
      title: "Clearable Event",
      description: "After clear",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("SlackDispatcher - Channel Routing", () => {
  it("should route admin actions to admin-actions channel", async () => {
    const result = await dispatchAdminAction({
      title: "Admin Test",
      description: "Admin action",
      severity: "info",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toBe(process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL);
  });

  it("should route audit logs to audit-log channel", async () => {
    const result = await dispatchAuditLog({
      title: "Audit Test",
      description: "Audit entry",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callUrl = fetchMock.mock.calls[0][0];
    expect(callUrl).toBe(process.env.SLACK_AUDIT_LOG_WEBHOOK_URL);
  });

  it("should send to both admin-actions and audit-log for combined dispatch", async () => {
    const result = await dispatchAdminActionWithAudit({
      title: "Combined Test",
      description: "Goes to both channels",
      severity: "warning",
      auditTitle: "Combined Audit",
      auditDescription: "Audit version",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const urls = fetchMock.mock.calls.map((c: any) => c[0]);
    expect(urls).toContain(process.env.SLACK_ADMIN_ACTIONS_WEBHOOK_URL);
    expect(urls).toContain(process.env.SLACK_AUDIT_LOG_WEBHOOK_URL);
  });
});

describe("SlackDispatcher - sendRawToChannel", () => {
  it("should send raw payload to channel", async () => {
    const result = await sendRawToChannel("admin-actions", {
      text: "Raw message",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "Hello" } }],
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should deduplicate raw messages by default", async () => {
    const payload = {
      text: "Raw dedup test",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "Same" } }],
    };

    await sendRawToChannel("admin-actions", payload);
    const result = await sendRawToChannel("admin-actions", payload);

    expect(result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should skip dedup when skipDedup is true", async () => {
    const payload = {
      text: "Raw skip dedup",
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "Forced" } }],
    };

    await sendRawToChannel("admin-actions", payload, { skipDedup: true });
    const result = await sendRawToChannel("admin-actions", payload, { skipDedup: true });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("SlackDispatcher - Error Handling", () => {
  it("should handle fetch failures gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const result = await dispatch({
      type: "admin_action_notification",
      title: "Error Test",
      description: "Should not crash",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(false);
  });

  it("should handle non-ok responses gracefully", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    } as any);

    const result = await dispatch({
      type: "admin_action_notification",
      title: "Error Response Test",
      description: "Should not crash",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(result.sent).toBe(false);
  });

  it("should skip channels with no webhook configured", async () => {
    // Temporarily unset the webhook
    const original = process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_WEBHOOK_URL;

    const result = await dispatch({
      type: "security_alert",
      title: "No Webhook Test",
      description: "Should skip",
      severity: "info",
      channels: ["security-alerts"],
    });

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    // Restore
    process.env.SLACK_WEBHOOK_URL = original;
  });
});

describe("SlackDispatcher - Multi-Channel Dedup", () => {
  it("should deduplicate per-channel independently", async () => {
    // Send to admin-actions
    await dispatch({
      type: "admin_action_with_audit",
      title: "Multi-Channel Event",
      description: "First",
      severity: "info",
      channels: ["admin-actions"],
    });

    // Send to audit-log (different channel, same event) — should go through
    const auditResult = await dispatch({
      type: "admin_action_with_audit",
      title: "Multi-Channel Event",
      description: "First",
      severity: "info",
      channels: ["audit-log"],
    });

    expect(auditResult.sent).toBe(true);

    // Send to admin-actions again — should be deduped
    const dupResult = await dispatch({
      type: "admin_action_with_audit",
      title: "Multi-Channel Event",
      description: "Duplicate",
      severity: "info",
      channels: ["admin-actions"],
    });

    expect(dupResult.sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2); // admin-actions + audit-log
  });

  it("should handle multi-channel dispatch in a single call", async () => {
    const result = await dispatch({
      type: "critical_security_alert",
      title: "Multi-Channel Single Call",
      description: "Goes to both",
      severity: "critical",
      channels: ["security-alerts", "admin-actions"],
    });

    expect(result.sent).toBe(true);
    expect(result.channels).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
