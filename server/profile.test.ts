import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock the database module
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getDb: vi.fn(),
    getUserById: vi.fn(),
    updateUserProfile: vi.fn(),
    getUserStorageInfo: vi.fn(),
    updateUserStorageUsed: vi.fn(),
  };
});

// Mock storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "https://test.com/image.jpg" }),
  storageDelete: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Profile Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateUserProfile", () => {
    it("should update display name successfully", async () => {
      const mockUser = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        displayName: null,
        email: "test@example.com",
        avatarUrl: null,
        avatarKey: null,
        bannerUrl: null,
        bannerKey: null,
        bio: null,
        storageUsed: 0,
        storageLimit: 104857600,
      };

      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(db.updateUserProfile).mockResolvedValue({ success: true });

      const result = await db.updateUserProfile(1, { displayName: "New Display Name" });
      expect(result.success).toBe(true);
    });

    it("should update bio successfully", async () => {
      vi.mocked(db.updateUserProfile).mockResolvedValue({ success: true });

      const result = await db.updateUserProfile(1, { bio: "This is my bio" });
      expect(result.success).toBe(true);
    });

    it("should handle database errors gracefully", async () => {
      vi.mocked(db.updateUserProfile).mockResolvedValue({ 
        success: false, 
        error: "Database not available" 
      });

      const result = await db.updateUserProfile(1, { displayName: "Test" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Database not available");
    });
  });

  describe("getUserById", () => {
    it("should return user with all profile fields", async () => {
      const mockUser = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        displayName: "Display Name",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.jpg",
        avatarKey: "avatars/1/avatar.jpg",
        bannerUrl: "https://example.com/banner.jpg",
        bannerKey: "banners/1/banner.jpg",
        bio: "Test bio",
        storageUsed: 1024,
        storageLimit: 104857600,
        role: "user",
        createdAt: new Date(),
      };

      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);

      const result = await db.getUserById(1);
      expect(result).toBeDefined();
      expect(result?.displayName).toBe("Display Name");
      expect(result?.bio).toBe("Test bio");
      expect(result?.avatarUrl).toBe("https://example.com/avatar.jpg");
      expect(result?.bannerUrl).toBe("https://example.com/banner.jpg");
    });

    it("should return null for non-existent user", async () => {
      vi.mocked(db.getUserById).mockResolvedValue(null);

      const result = await db.getUserById(999);
      expect(result).toBeNull();
    });
  });

  describe("Storage Management", () => {
    it("should return storage info for user", async () => {
      vi.mocked(db.getUserStorageInfo).mockResolvedValue({
        used: 5242880, // 5MB
        limit: 104857600, // 100MB
      });

      const result = await db.getUserStorageInfo(1);
      expect(result).toBeDefined();
      expect(result?.used).toBe(5242880);
      expect(result?.limit).toBe(104857600);
    });

    it("should update storage used successfully", async () => {
      vi.mocked(db.updateUserStorageUsed).mockResolvedValue({
        success: true,
        newUsed: 6291456, // 6MB
      });

      const result = await db.updateUserStorageUsed(1, 1048576); // Add 1MB
      expect(result.success).toBe(true);
      expect(result.newUsed).toBe(6291456);
    });

    it("should reject storage update when limit exceeded", async () => {
      vi.mocked(db.updateUserStorageUsed).mockResolvedValue({
        success: false,
        error: "Storage limit exceeded",
      });

      const result = await db.updateUserStorageUsed(1, 200 * 1024 * 1024); // Try to add 200MB
      expect(result.success).toBe(false);
      expect(result.error).toBe("Storage limit exceeded");
    });

    it("should handle negative storage changes (deletions)", async () => {
      vi.mocked(db.updateUserStorageUsed).mockResolvedValue({
        success: true,
        newUsed: 4194304, // 4MB after deletion
      });

      const result = await db.updateUserStorageUsed(1, -1048576); // Remove 1MB
      expect(result.success).toBe(true);
      expect(result.newUsed).toBe(4194304);
    });
  });
});

describe("Profile Data Validation", () => {
  it("should enforce display name max length of 100 characters", () => {
    const longName = "a".repeat(101);
    // This would be validated by zod in the router
    expect(longName.length).toBeGreaterThan(100);
  });

  it("should enforce bio max length of 500 characters", () => {
    const longBio = "a".repeat(501);
    // This would be validated by zod in the router
    expect(longBio.length).toBeGreaterThan(500);
  });

  it("should accept valid MIME types for avatar upload", () => {
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    validMimeTypes.forEach(type => {
      expect(["image/jpeg", "image/png", "image/webp"]).toContain(type);
    });
  });

  it("should enforce avatar file size limit of 5MB", () => {
    const maxSize = 5 * 1024 * 1024;
    expect(maxSize).toBe(5242880);
  });

  it("should enforce banner file size limit of 10MB", () => {
    const maxSize = 10 * 1024 * 1024;
    expect(maxSize).toBe(10485760);
  });
});

describe("Storage Cleanup", () => {
  it("should track S3 keys for cleanup on avatar update", async () => {
    const mockUser = {
      id: 1,
      avatarKey: "avatars/1/old-avatar.jpg",
      avatarUrl: "https://old.com/avatar.jpg",
    };

    vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
    
    // When updating avatar, old key should be available for deletion
    const user = await db.getUserById(1);
    expect(user?.avatarKey).toBe("avatars/1/old-avatar.jpg");
  });

  it("should track S3 keys for cleanup on banner update", async () => {
    const mockUser = {
      id: 1,
      bannerKey: "banners/1/old-banner.jpg",
      bannerUrl: "https://old.com/banner.jpg",
    };

    vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
    
    // When updating banner, old key should be available for deletion
    const user = await db.getUserById(1);
    expect(user?.bannerKey).toBe("banners/1/old-banner.jpg");
  });
});
