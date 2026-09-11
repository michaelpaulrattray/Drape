import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #796's law-7 sibling, found on the sweep for the class (a db helper's
 * `{ success }` verdict dropped by its caller): the Slack emergency
 * "Suspend user" button read `suspendUser`'s OBJECT as a boolean —
 * `const success = await suspendUser(...); if (!success)` — so a failed
 * suspension was always truthy. Slack was told "✅ suspended" over an account
 * still live, and an `EMERGENCY_ACTION_EXECUTED` audit row was written for an
 * action that never executed. The block-IP handler beside it read
 * `result.success` from the day it was written.
 *
 * Driven through the real Express handler with a genuinely signed request (the
 * signature check is real; the secret is stubbed) and `fetch` captured, so the
 * assertion is the text that would reach the Slack channel — not the return
 * value of a helper. The positive control runs the same road with a successful
 * suspend and asserts the success message and the audit row.
 */

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  consumeEmergencyToken: vi.fn(),
  suspendUser: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("../auditLog", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./slackNotification", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  SlackAlerts: new Proxy({}, { get: () => vi.fn().mockResolvedValue(true) }),
  sendAuditLogEntry: vi.fn().mockResolvedValue(true),
  sendEmergencyActionsToAdminChannel: vi.fn().mockResolvedValue(true),
}));

import { handleSlackInteraction } from "./slackInteractions";
import { consumeEmergencyToken, suspendUser } from "../db";
import { logAuditEvent } from "../auditLog";

const SECRET = "test-signing-secret";
const RESPONSE_URL = "https://hooks.slack.test/response";

function signedSuspendRequest(userId: number) {
  const payload = JSON.stringify({
    type: "block_actions",
    user: { id: "U1", name: "Mike", username: "mike" },
    response_url: RESPONSE_URL,
    actions: [
      {
        action_id: "suspend_user",
        value: JSON.stringify({ token: "tok_1", userId, userName: "Some Customer" }),
      },
    ],
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = `payload=${encodeURIComponent(payload)}`;
  const signature =
    "v0=" + crypto.createHmac("sha256", SECRET).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  return {
    req: {
      body: { payload },
      headers: { "x-slack-signature": signature, "x-slack-request-timestamp": timestamp },
    },
    res: { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() },
  };
}

/** Every message the handler posted back to Slack, in order. */
const slackMessages = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls
    .filter(([url]) => url === RESPONSE_URL)
    .map(([, init]) => JSON.parse((init as RequestInit).body as string).text as string);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SLACK_SIGNING_SECRET", SECRET);
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(consumeEmergencyToken).mockResolvedValue({
    action: "suspend_user",
    targetId: "77",
    metadata: { alertTitle: "Credential stuffing" },
  } as Awaited<ReturnType<typeof consumeEmergencyToken>>);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("#796 sibling — the Slack emergency suspend reads the helper's verdict", () => {
  it("a FAILED suspension tells Slack it failed and writes no EXECUTED audit row", async () => {
    vi.mocked(suspendUser).mockResolvedValue({ success: false, error: "Database not available" });
    const { req, res } = signedSuspendRequest(77);

    await handleSlackInteraction(req as never, res as never);

    expect(suspendUser).toHaveBeenCalledTimes(1);
    const messages = slackMessages(fetchMock);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Action Failed");
    expect(messages[0]).not.toContain("✅");
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("positive control: a successful suspension confirms in Slack and audits the executed action", async () => {
    vi.mocked(suspendUser).mockResolvedValue({ success: true });
    const { req, res } = signedSuspendRequest(77);

    await handleSlackInteraction(req as never, res as never);

    const messages = slackMessages(fetchMock);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("✅");
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logAuditEvent).mock.calls[0][0]).toMatchObject({
      resourceId: "77",
      metadata: expect.objectContaining({ action: "suspend_user", source: "slack_button" }),
    });
  });
});
