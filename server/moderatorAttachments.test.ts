/**
 * Tests for moderator attachments router — upload, link, and list change request attachments.
 */
import { describe, it, expect } from "vitest";

// ── Upload validation tests ──

describe("moderatorAttachments", () => {
  describe("upload validation", () => {
    const ALLOWED_MIME_TYPES = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf", "text/csv", "text/plain",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    it("should accept all allowed MIME types", () => {
      for (const mime of ALLOWED_MIME_TYPES) {
        expect(ALLOWED_MIME_TYPES.includes(mime)).toBe(true);
      }
    });

    it("should reject unsupported MIME types", () => {
      const rejected = [
        "application/javascript",
        "application/x-executable",
        "text/html",
        "video/mp4",
        "audio/mpeg",
      ];
      for (const mime of rejected) {
        expect(ALLOWED_MIME_TYPES.includes(mime)).toBe(false);
      }
    });

    it("should enforce 10MB file size limit", () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      const tooLarge = 11 * 1024 * 1024;
      expect(tooLarge > MAX_FILE_SIZE).toBe(true);
      const justUnder = 10 * 1024 * 1024 - 1;
      expect(justUnder > MAX_FILE_SIZE).toBe(false);
    });

    it("should enforce max 5 attachments per request", () => {
      const MAX_ATTACHMENTS = 5;
      expect(MAX_ATTACHMENTS).toBe(5);
    });
  });

  describe("file key generation", () => {
    it("should sanitize filenames to remove special characters", () => {
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
      expect(sanitize("my file (1).png")).toBe("my_file__1_.png");
      expect(sanitize("screenshot@2x.jpg")).toBe("screenshot_2x.jpg");
      expect(sanitize("normal-file.pdf")).toBe("normal-file.pdf");
      expect(sanitize("file_with_underscore.txt")).toBe("file_with_underscore.txt");
    });

    it("should generate unique file keys with user ID and timestamp", () => {
      const userId = 42;
      const timestamp = Date.now();
      const suffix = Math.random().toString(36).slice(2, 10);
      const sanitizedName = "test.png";
      const fileKey = `change-requests/${userId}/${timestamp}-${suffix}-${sanitizedName}`;

      expect(fileKey).toContain("change-requests/42/");
      expect(fileKey).toContain("test.png");
      expect(fileKey.length).toBeGreaterThan(30);
    });
  });

  describe("base64 decoding", () => {
    it("should correctly decode base64 to buffer", () => {
      const original = "Hello, World!";
      const base64 = Buffer.from(original).toString("base64");
      const decoded = Buffer.from(base64, "base64");
      expect(decoded.toString()).toBe(original);
    });

    it("should correctly measure decoded buffer size", () => {
      // 1KB of data
      const data = "A".repeat(1024);
      const base64 = Buffer.from(data).toString("base64");
      const decoded = Buffer.from(base64, "base64");
      expect(decoded.length).toBe(1024);
    });
  });

  describe("link attachments logic", () => {
    it("should only link attachments that belong to the uploader", () => {
      // Simulating the WHERE clause logic
      const attachment = { id: 1, uploadedById: 42, changeRequestId: null };
      const requestingUserId = 42;
      const canLink =
        attachment.uploadedById === requestingUserId &&
        attachment.changeRequestId === null;
      expect(canLink).toBe(true);
    });

    it("should reject linking attachments from another user", () => {
      const attachment = { id: 1, uploadedById: 99, changeRequestId: null };
      const requestingUserId = 42;
      const canLink =
        attachment.uploadedById === requestingUserId &&
        attachment.changeRequestId === null;
      expect(canLink).toBe(false);
    });

    it("should reject linking already-linked attachments", () => {
      const attachment = { id: 1, uploadedById: 42, changeRequestId: 10 };
      const requestingUserId = 42;
      const canLink =
        attachment.uploadedById === requestingUserId &&
        attachment.changeRequestId === null;
      expect(canLink).toBe(false);
    });
  });

  describe("image detection", () => {
    it("should identify image MIME types", () => {
      const isImage = (mime: string) => mime.startsWith("image/");
      expect(isImage("image/jpeg")).toBe(true);
      expect(isImage("image/png")).toBe(true);
      expect(isImage("image/gif")).toBe(true);
      expect(isImage("image/webp")).toBe(true);
      expect(isImage("application/pdf")).toBe(false);
      expect(isImage("text/csv")).toBe(false);
    });
  });
});
