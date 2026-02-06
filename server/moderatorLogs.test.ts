import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("./db", () => ({
  getModeratorCreditHistory: vi.fn(),
  getModeratorGenerationHistory: vi.fn(),
}));

import { getModeratorCreditHistory, getModeratorGenerationHistory } from "./db";

describe("Moderator Credit & Generation Log Viewers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getModeratorCreditHistory", () => {
    it("should return credit transactions with summary for a user", async () => {
      const mockResult = {
        transactions: [
          {
            id: 1,
            userId: 42,
            amount: 100,
            type: "purchase",
            description: "Purchased 100 credits",
            balanceAfter: 100,
            createdAt: new Date("2026-01-15"),
          },
          {
            id: 2,
            userId: 42,
            amount: -10,
            type: "usage",
            description: "Generation #5",
            balanceAfter: 90,
            createdAt: new Date("2026-01-16"),
          },
        ],
        total: 2,
        summary: {
          totalCreditsEarned: 100,
          totalCreditsSpent: 10,
          netChange: 90,
          transactionsByType: {
            purchase: { count: 1, totalAmount: 100 },
            usage: { count: 1, totalAmount: -10 },
          },
        },
      };

      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorCreditHistory({
        userId: 42,
        limit: 20,
        offset: 0,
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.summary.totalCreditsEarned).toBe(100);
      expect(result.summary.totalCreditsSpent).toBe(10);
      expect(result.summary.netChange).toBe(90);
    });

    it("should filter by transaction type", async () => {
      const mockResult = {
        transactions: [
          {
            id: 1,
            userId: 42,
            amount: 100,
            type: "purchase",
            description: "Purchased 100 credits",
            balanceAfter: 100,
            createdAt: new Date("2026-01-15"),
          },
        ],
        total: 1,
        summary: {
          totalCreditsEarned: 100,
          totalCreditsSpent: 0,
          netChange: 100,
          transactionsByType: {
            purchase: { count: 1, totalAmount: 100 },
          },
        },
      };

      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorCreditHistory({
        userId: 42,
        limit: 20,
        offset: 0,
        type: "purchase",
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].type).toBe("purchase");
    });

    it("should handle empty credit history", async () => {
      const mockResult = {
        transactions: [],
        total: 0,
        summary: {
          totalCreditsEarned: 0,
          totalCreditsSpent: 0,
          netChange: 0,
          transactionsByType: {},
        },
      };

      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorCreditHistory({
        userId: 999,
        limit: 20,
        offset: 0,
      });

      expect(result.transactions).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.summary.netChange).toBe(0);
    });

    it("should support pagination with offset", async () => {
      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        transactions: [],
        total: 50,
        summary: {
          totalCreditsEarned: 500,
          totalCreditsSpent: 200,
          netChange: 300,
          transactionsByType: {},
        },
      });

      await getModeratorCreditHistory({
        userId: 42,
        limit: 20,
        offset: 20,
      });

      expect(getModeratorCreditHistory).toHaveBeenCalledWith({
        userId: 42,
        limit: 20,
        offset: 20,
      });
    });

    it("should include balanceAfter for each transaction", async () => {
      const mockResult = {
        transactions: [
          { id: 1, userId: 42, amount: 100, type: "purchase", description: "Buy", balanceAfter: 100, createdAt: new Date() },
          { id: 2, userId: 42, amount: -30, type: "usage", description: "Use", balanceAfter: 70, createdAt: new Date() },
          { id: 3, userId: 42, amount: 50, type: "admin_adjustment", description: "Refund", balanceAfter: 120, createdAt: new Date() },
        ],
        total: 3,
        summary: {
          totalCreditsEarned: 150,
          totalCreditsSpent: 30,
          netChange: 120,
          transactionsByType: {},
        },
      };

      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorCreditHistory({ userId: 42, limit: 20, offset: 0 });

      expect(result.transactions[0].balanceAfter).toBe(100);
      expect(result.transactions[1].balanceAfter).toBe(70);
      expect(result.transactions[2].balanceAfter).toBe(120);
    });
  });

  describe("getModeratorGenerationHistory", () => {
    it("should return generation history with summary for a user", async () => {
      const mockResult = {
        generations: [
          {
            id: 1,
            modelId: 5,
            type: "headshot",
            status: "completed",
            pointsCost: 10,
            resultUrl: "https://example.com/result.jpg",
            errorMessage: null,
            metadata: {},
            createdAt: new Date("2026-01-15"),
            completedAt: new Date("2026-01-15"),
            modelName: "My Model",
          },
          {
            id: 2,
            modelId: 5,
            type: "full_body",
            status: "failed",
            pointsCost: 0,
            resultUrl: null,
            errorMessage: "GPU out of memory",
            metadata: {},
            createdAt: new Date("2026-01-16"),
            completedAt: null,
            modelName: "My Model",
          },
        ],
        total: 2,
        summary: {
          totalGenerations: 2,
          completedCount: 1,
          failedCount: 1,
          pendingCount: 0,
          totalCreditsUsed: 10,
          generationsByType: {
            headshot: { count: 1, totalCost: 10 },
            full_body: { count: 1, totalCost: 0 },
          },
          failureRate: 50,
        },
      };

      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorGenerationHistory({
        userId: 42,
        limit: 20,
        offset: 0,
      });

      expect(result.generations).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.summary.completedCount).toBe(1);
      expect(result.summary.failedCount).toBe(1);
      expect(result.summary.totalCreditsUsed).toBe(10);
      expect(result.summary.failureRate).toBe(50);
    });

    it("should filter by generation status", async () => {
      const mockResult = {
        generations: [
          {
            id: 2,
            modelId: 5,
            type: "full_body",
            status: "failed",
            pointsCost: 0,
            resultUrl: null,
            errorMessage: "GPU out of memory",
            metadata: {},
            createdAt: new Date("2026-01-16"),
            completedAt: null,
            modelName: "My Model",
          },
        ],
        total: 1,
        summary: {
          totalGenerations: 1,
          completedCount: 0,
          failedCount: 1,
          pendingCount: 0,
          totalCreditsUsed: 0,
          generationsByType: { full_body: { count: 1, totalCost: 0 } },
          failureRate: 100,
        },
      };

      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorGenerationHistory({
        userId: 42,
        limit: 20,
        offset: 0,
        status: "failed",
      });

      expect(result.generations).toHaveLength(1);
      expect(result.generations[0].status).toBe("failed");
      expect(result.generations[0].errorMessage).toBe("GPU out of memory");
    });

    it("should filter by generation type", async () => {
      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        generations: [
          {
            id: 1,
            modelId: 5,
            type: "headshot",
            status: "completed",
            pointsCost: 10,
            resultUrl: "https://example.com/result.jpg",
            errorMessage: null,
            metadata: {},
            createdAt: new Date(),
            completedAt: new Date(),
            modelName: "Model A",
          },
        ],
        total: 1,
        summary: {
          totalGenerations: 1,
          completedCount: 1,
          failedCount: 0,
          pendingCount: 0,
          totalCreditsUsed: 10,
          generationsByType: { headshot: { count: 1, totalCost: 10 } },
          failureRate: 0,
        },
      });

      const result = await getModeratorGenerationHistory({
        userId: 42,
        limit: 20,
        offset: 0,
        type: "headshot",
      });

      expect(result.generations[0].type).toBe("headshot");
    });

    it("should handle empty generation history", async () => {
      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        generations: [],
        total: 0,
        summary: {
          totalGenerations: 0,
          completedCount: 0,
          failedCount: 0,
          pendingCount: 0,
          totalCreditsUsed: 0,
          generationsByType: {},
          failureRate: 0,
        },
      });

      const result = await getModeratorGenerationHistory({
        userId: 999,
        limit: 20,
        offset: 0,
      });

      expect(result.generations).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.summary.failureRate).toBe(0);
    });

    it("should include model name in generation records", async () => {
      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        generations: [
          {
            id: 1,
            modelId: 5,
            type: "headshot",
            status: "completed",
            pointsCost: 10,
            resultUrl: "https://example.com/result.jpg",
            errorMessage: null,
            metadata: {},
            createdAt: new Date(),
            completedAt: new Date(),
            modelName: "Professional Headshot Model",
          },
        ],
        total: 1,
        summary: {
          totalGenerations: 1,
          completedCount: 1,
          failedCount: 0,
          pendingCount: 0,
          totalCreditsUsed: 10,
          generationsByType: {},
          failureRate: 0,
        },
      });

      const result = await getModeratorGenerationHistory({ userId: 42, limit: 20, offset: 0 });

      expect(result.generations[0].modelName).toBe("Professional Headshot Model");
    });

    it("should include error messages for failed generations", async () => {
      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        generations: [
          {
            id: 1,
            modelId: null,
            type: "creative",
            status: "failed",
            pointsCost: 0,
            resultUrl: null,
            errorMessage: "NSFW content detected",
            metadata: { reason: "content_filter" },
            createdAt: new Date(),
            completedAt: null,
            modelName: null,
          },
        ],
        total: 1,
        summary: {
          totalGenerations: 1,
          completedCount: 0,
          failedCount: 1,
          pendingCount: 0,
          totalCreditsUsed: 0,
          generationsByType: {},
          failureRate: 100,
        },
      });

      const result = await getModeratorGenerationHistory({ userId: 42, limit: 20, offset: 0 });

      expect(result.generations[0].errorMessage).toBe("NSFW content detected");
      expect(result.generations[0].status).toBe("failed");
    });

    it("should calculate failure rate correctly", async () => {
      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue({
        generations: [],
        total: 10,
        summary: {
          totalGenerations: 10,
          completedCount: 7,
          failedCount: 3,
          pendingCount: 0,
          totalCreditsUsed: 70,
          generationsByType: {},
          failureRate: 30,
        },
      });

      const result = await getModeratorGenerationHistory({ userId: 42, limit: 20, offset: 0 });

      expect(result.summary.failureRate).toBe(30);
      expect(result.summary.completedCount + result.summary.failedCount).toBe(10);
    });
  });

  describe("Moderator read-only access verification", () => {
    it("should not expose any mutation capabilities in credit history", async () => {
      // Credit history should only return data, no mutation methods
      const mockResult = {
        transactions: [],
        total: 0,
        summary: {
          totalCreditsEarned: 0,
          totalCreditsSpent: 0,
          netChange: 0,
          transactionsByType: {},
        },
      };

      (getModeratorCreditHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorCreditHistory({ userId: 42, limit: 20, offset: 0 });

      // Verify the result is a plain data object with no mutation methods
      expect(typeof result).toBe("object");
      expect(result).not.toHaveProperty("update");
      expect(result).not.toHaveProperty("delete");
      expect(result).not.toHaveProperty("adjust");
    });

    it("should not expose any mutation capabilities in generation history", async () => {
      const mockResult = {
        generations: [],
        total: 0,
        summary: {
          totalGenerations: 0,
          completedCount: 0,
          failedCount: 0,
          pendingCount: 0,
          totalCreditsUsed: 0,
          generationsByType: {},
          failureRate: 0,
        },
      };

      (getModeratorGenerationHistory as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const result = await getModeratorGenerationHistory({ userId: 42, limit: 20, offset: 0 });

      expect(typeof result).toBe("object");
      expect(result).not.toHaveProperty("update");
      expect(result).not.toHaveProperty("delete");
      expect(result).not.toHaveProperty("retry");
    });
  });
});
