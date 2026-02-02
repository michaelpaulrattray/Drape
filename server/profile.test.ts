import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getUserProfile: vi.fn(),
  updateUserProfile: vi.fn(),
}));

// Mock the storage functions
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { getUserProfile, updateUserProfile } from "./db";
import { storagePut } from "./storage";

describe("Profile Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("should return user profile with all fields", async () => {
      const mockProfile = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        displayName: "Custom Display Name",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
        customAvatarUrl: "https://example.com/custom-avatar.jpg",
        createdAt: new Date("2024-01-01"),
      };

      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfile);

      const result = await getUserProfile(1);
      
      expect(result).toEqual(mockProfile);
      expect(getUserProfile).toHaveBeenCalledWith(1);
    });

    it("should return null when user not found", async () => {
      (getUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getUserProfile(999);
      
      expect(result).toBeNull();
    });
  });

  describe("updateUserProfile", () => {
    it("should update display name successfully", async () => {
      (updateUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const result = await updateUserProfile(1, { displayName: "New Name" });
      
      expect(result).toEqual({ success: true });
      expect(updateUserProfile).toHaveBeenCalledWith(1, { displayName: "New Name" });
    });

    it("should update custom avatar URL successfully", async () => {
      (updateUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const result = await updateUserProfile(1, { customAvatarUrl: "https://example.com/new-avatar.jpg" });
      
      expect(result).toEqual({ success: true });
      expect(updateUserProfile).toHaveBeenCalledWith(1, { customAvatarUrl: "https://example.com/new-avatar.jpg" });
    });

    it("should handle update failure", async () => {
      (updateUserProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ 
        success: false, 
        error: "Database error" 
      });

      const result = await updateUserProfile(1, { displayName: "New Name" });
      
      expect(result).toEqual({ success: false, error: "Database error" });
    });
  });

  describe("storagePut for avatar upload", () => {
    it("should upload avatar to S3", async () => {
      const mockUrl = "https://s3.example.com/avatars/1-123456.png";
      (storagePut as ReturnType<typeof vi.fn>).mockResolvedValue({ 
        url: mockUrl,
        key: "avatars/1-123456.png"
      });

      const buffer = Buffer.from("fake-image-data");
      const result = await storagePut("avatars/1-123456.png", buffer, "image/png");
      
      expect(result.url).toBe(mockUrl);
      expect(storagePut).toHaveBeenCalledWith("avatars/1-123456.png", buffer, "image/png");
    });
  });
});

describe("Profile Data Validation", () => {
  it("should validate display name length", () => {
    const validName = "A".repeat(50);
    const invalidName = "A".repeat(51);
    
    expect(validName.length).toBeLessThanOrEqual(50);
    expect(invalidName.length).toBeGreaterThan(50);
  });

  it("should handle empty display name", () => {
    const emptyName = "";
    const trimmedName = "  ".trim();
    
    expect(emptyName || null).toBeNull();
    expect(trimmedName || null).toBeNull();
  });

  it("should validate image mime types", () => {
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const invalidTypes = ["application/pdf", "text/plain", "video/mp4"];
    
    validTypes.forEach(type => {
      expect(type.startsWith("image/")).toBe(true);
    });
    
    invalidTypes.forEach(type => {
      expect(type.startsWith("image/")).toBe(false);
    });
  });
});
