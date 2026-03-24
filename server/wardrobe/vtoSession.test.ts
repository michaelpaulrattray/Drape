/**
 * VTO Session Manager Tests — Service 9: "The Memory"
 *
 * Tests session lifecycle: seed, get, clear, expiry, cleanup, and
 * garmentRefinement integration (session reuse vs stateless fallback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue({
  candidates: [{ content: { parts: [{ text: "Context acknowledged." }] } }],
});

const mockChatsCreate = vi.fn().mockReturnValue({
  sendMessage: mockSendMessage,
});

vi.mock("./utils", () => ({
  getAiClient: () => ({
    chats: { create: mockChatsCreate },
  }),
  SAFETY_SETTINGS: [],
  toInlinePart: vi.fn().mockResolvedValue({ inlineData: { data: "base64", mimeType: "image/png" } }),
}));

vi.mock("../logging/logger", () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  seedSession,
  getSession,
  clearSession,
  clearAllUserSessions,
} from "./vtoSession";

// ── Helpers ───────────────────────────────────────────────────────────────

const USER_ID = 42;
const SESSION_ID = "sess-abc";
const MODEL_URL = "https://example.com/model.png";
const RESULT_URL = "https://example.com/result.png";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("VTO Session Manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all sessions between tests
    clearAllUserSessions(USER_ID);
    clearAllUserSessions(99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── seedSession ───────────────────────────────────────────────

  describe("seedSession", () => {
    it("creates a Gemini chat and stores the session", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);

      expect(mockChatsCreate).toHaveBeenCalledOnce();
      expect(mockChatsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-3-pro-image-preview",
          config: expect.objectContaining({
            responseModalities: ["TEXT"],
          }),
        }),
      );
      expect(mockSendMessage).toHaveBeenCalledOnce();

      const entry = getSession(USER_ID, SESSION_ID);
      expect(entry).not.toBeNull();
      expect(entry!.lastResultUrl).toBe(RESULT_URL);
    });

    it("includes outfit description in seed message when provided", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL, "black jacket, white shirt");

      const call = mockSendMessage.mock.calls[0][0];
      const textPart = call.message.find((p: any) => p.text);
      expect(textPart.text).toContain("black jacket, white shirt");
    });

    it("omits outfit description line when not provided", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);

      const call = mockSendMessage.mock.calls[0][0];
      const textPart = call.message.find((p: any) => p.text);
      expect(textPart.text).not.toContain("The current outfit consists of:");
    });

    it("overwrites existing session on re-seed", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);
      const first = getSession(USER_ID, SESSION_ID);

      await seedSession(USER_ID, SESSION_ID, MODEL_URL, "https://example.com/result2.png");
      const second = getSession(USER_ID, SESSION_ID);

      expect(second).not.toBeNull();
      expect(second!.lastResultUrl).toBe("https://example.com/result2.png");
      // The chat object should be different (new create call)
      expect(mockChatsCreate).toHaveBeenCalledTimes(2);
    });

    it("does not throw when Gemini chat.sendMessage fails", async () => {
      mockSendMessage.mockRejectedValueOnce(new Error("API error"));

      // Should not throw
      await expect(
        seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL),
      ).resolves.toBeUndefined();

      // Session should NOT be stored on failure
      expect(getSession(USER_ID, SESSION_ID)).toBeNull();
    });
  });

  // ── getSession ────────────────────────────────────────────────

  describe("getSession", () => {
    it("returns null for non-existent session", () => {
      expect(getSession(USER_ID, "nonexistent")).toBeNull();
    });

    it("returns the session entry after successful seed", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);
      const entry = getSession(USER_ID, SESSION_ID);

      expect(entry).not.toBeNull();
      expect(entry!.chat).toBeDefined();
      expect(entry!.lastResultUrl).toBe(RESULT_URL);
      expect(entry!.createdAt).toBeGreaterThan(0);
    });

    it("evicts expired sessions and returns null", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);

      // Manually set createdAt to 31 minutes ago
      const entry = getSession(USER_ID, SESSION_ID);
      expect(entry).not.toBeNull();

      // Hack: directly modify the entry's createdAt via the map
      // We need to access the internal map — use a workaround by re-seeding
      // then manipulating time
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      clearSession(USER_ID, SESSION_ID);
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);

      // Advance time by 31 minutes
      vi.setSystemTime(now + 31 * 60 * 1000);

      const expired = getSession(USER_ID, SESSION_ID);
      expect(expired).toBeNull();

      vi.useRealTimers();
    });

    it("returns session within TTL window", async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);

      // Advance 29 minutes (still within 30-min TTL)
      vi.setSystemTime(now + 29 * 60 * 1000);
      const entry = getSession(USER_ID, SESSION_ID);
      expect(entry).not.toBeNull();

      vi.useRealTimers();
    });

    it("isolates sessions by userId", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);
      await seedSession(99, SESSION_ID, MODEL_URL, "https://other.com/r.png");

      const entry42 = getSession(USER_ID, SESSION_ID);
      const entry99 = getSession(99, SESSION_ID);

      expect(entry42!.lastResultUrl).toBe(RESULT_URL);
      expect(entry99!.lastResultUrl).toBe("https://other.com/r.png");
    });
  });

  // ── clearSession ──────────────────────────────────────────────

  describe("clearSession", () => {
    it("removes a specific session", async () => {
      await seedSession(USER_ID, SESSION_ID, MODEL_URL, RESULT_URL);
      expect(getSession(USER_ID, SESSION_ID)).not.toBeNull();

      clearSession(USER_ID, SESSION_ID);
      expect(getSession(USER_ID, SESSION_ID)).toBeNull();
    });

    it("is a no-op for non-existent session", () => {
      // Should not throw
      clearSession(USER_ID, "nonexistent");
    });
  });

  // ── clearAllUserSessions ──────────────────────────────────────

  describe("clearAllUserSessions", () => {
    it("removes all sessions for a specific user", async () => {
      await seedSession(USER_ID, "sess-1", MODEL_URL, RESULT_URL);
      await seedSession(USER_ID, "sess-2", MODEL_URL, RESULT_URL);
      await seedSession(99, "sess-3", MODEL_URL, RESULT_URL);

      clearAllUserSessions(USER_ID);

      expect(getSession(USER_ID, "sess-1")).toBeNull();
      expect(getSession(USER_ID, "sess-2")).toBeNull();
      // Other user's session should remain
      expect(getSession(99, "sess-3")).not.toBeNull();
    });

    it("is a no-op when user has no sessions", () => {
      clearAllUserSessions(USER_ID);
      // Should not throw
    });
  });
});
