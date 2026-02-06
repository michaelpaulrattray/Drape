import { describe, it, expect, vi, beforeEach } from "vitest";
import { testConnection, newsletterSignup } from "./klaviyo";

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
});
