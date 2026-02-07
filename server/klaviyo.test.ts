import { describe, it, expect, vi, beforeEach } from "vitest";
import { testConnection, newsletterSignup, sendAccountFrozenEmail } from "./klaviyo";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Klaviyo Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the environment variable for tests
    process.env.KLAVIYO_PRIVATE_KEY = "pk_test_key";
  });

  describe("testConnection", () => {
    it("should return success when API responds with 200", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const result = await testConnection();

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://a.klaviyo.com/api/lists",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Klaviyo-API-Key pk_test_key",
          }),
        })
      );
    });

    it("should return error when API responds with non-200", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("newsletterSignup", () => {
    it("should create a new profile successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: "profile_123" },
        }),
      });

      const result = await newsletterSignup("test@example.com", "website_footer");

      expect(result.success).toBe(true);
      expect(result.profileId).toBe("profile_123");
      expect(result.isNew).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://a.klaviyo.com/api/profiles",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test@example.com"),
        })
      );
    });

    it("should handle existing profile (409 conflict)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const result = await newsletterSignup("existing@example.com");

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      const result = await newsletterSignup("test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should include signup source in request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: "profile_456" } }),
      });

      await newsletterSignup("test@example.com", "landing_page");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.properties.signup_source).toBe("landing_page");
    });
  });

  describe("sendAccountFrozenEmail", () => {
    it("should create/update profile then fire Account Frozen event", async () => {
      // First call: createOrUpdateProfile (profile-import)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "profile_789" } }),
      });
      // Second call: trackEvent (events)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      const result = await sendAccountFrozenEmail({
        userEmail: "frozen@example.com",
        userName: "Test User",
        freezeReason: "Auto-frozen: credit discrepancy of 2500 credits",
        frozenBy: "system",
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify profile creation call
      const profileCall = mockFetch.mock.calls[0];
      expect(profileCall[0]).toBe("https://a.klaviyo.com/api/profile-import");
      const profileBody = JSON.parse(profileCall[1].body);
      expect(profileBody.data.attributes.email).toBe("frozen@example.com");
      expect(profileBody.data.attributes.first_name).toBe("Test User");
      expect(profileBody.data.attributes.properties.account_frozen).toBe(true);

      // Verify event tracking call
      const eventCall = mockFetch.mock.calls[1];
      expect(eventCall[0]).toBe("https://a.klaviyo.com/api/events");
      const eventBody = JSON.parse(eventCall[1].body);
      expect(eventBody.data.attributes.metric.data.attributes.name).toBe("Account Frozen");
      expect(eventBody.data.attributes.profile.data.attributes.email).toBe("frozen@example.com");
      expect(eventBody.data.attributes.properties.user_name).toBe("Test User");
      expect(eventBody.data.attributes.properties.freeze_reason).toContain("credit discrepancy");
      expect(eventBody.data.attributes.properties.frozen_by).toBe("system");
      expect(eventBody.data.attributes.properties.app_name).toBe("FormaStudio");
      expect(eventBody.data.attributes.properties.support_url).toBe("https://formastudio.ai/support");
    });

    it("should use custom support URL when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "profile_789" } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      await sendAccountFrozenEmail({
        userEmail: "frozen@example.com",
        userName: "Test User",
        freezeReason: "Manual freeze",
        frozenBy: "Moderator Jane",
        supportUrl: "https://formastudio.ai/help",
      });

      const eventBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(eventBody.data.attributes.properties.support_url).toBe("https://formastudio.ai/help");
      expect(eventBody.data.attributes.properties.frozen_by).toBe("Moderator Jane");
    });

    it("should handle profile creation failure gracefully and still attempt event", async () => {
      // Profile creation fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });
      // Event tracking succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      const result = await sendAccountFrozenEmail({
        userEmail: "frozen@example.com",
        userName: "Test User",
        freezeReason: "Test reason",
        frozenBy: "system",
      });

      // Event should still be attempted even if profile creation failed
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("should return failure when event tracking fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "profile_789" } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      const result = await sendAccountFrozenEmail({
        userEmail: "frozen@example.com",
        userName: "Test User",
        freezeReason: "Test reason",
        frozenBy: "system",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should include frozen_date as human-readable string", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "profile_789" } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({}),
      });

      await sendAccountFrozenEmail({
        userEmail: "frozen@example.com",
        userName: "Test User",
        freezeReason: "Test",
        frozenBy: "system",
      });

      const eventBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      // frozen_date should be a human-readable date string (e.g., "February 8, 2026")
      expect(eventBody.data.attributes.properties.frozen_date).toMatch(/\w+ \d{1,2}, \d{4}/);
    });
  });
});
