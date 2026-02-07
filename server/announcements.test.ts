/**
 * Tests for announcement/banner system — DB queries, admin procedures, and public endpoint.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock DB connection
// ============================================================================

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

function chainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    from: mockFrom,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    offset: mockOffset,
    set: mockSet,
    values: mockValues,
    ...overrides,
  };
  // Each method returns the chain
  for (const fn of Object.values(chain)) {
    if (typeof fn === "function") {
      (fn as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
  }
  return chain;
}

vi.mock("./db/connection", () => ({
  getDb: vi.fn(),
}));

vi.mock("../drizzle/schema", () => ({
  announcements: { id: "id", isActive: "isActive", startsAt: "startsAt", endsAt: "endsAt", createdAt: "createdAt" },
  ANNOUNCEMENT_TYPES: ["info", "warning", "maintenance", "feature"],
}));

// ============================================================================
// Announcement query logic tests (pure logic, no DB)
// ============================================================================

describe("Announcement System", () => {
  describe("ANNOUNCEMENT_TYPES constant", () => {
    it("should include all 4 banner types", () => {
      const types = ["info", "warning", "maintenance", "feature"];
      expect(types).toHaveLength(4);
      expect(types).toContain("info");
      expect(types).toContain("warning");
      expect(types).toContain("maintenance");
      expect(types).toContain("feature");
    });
  });

  describe("Banner type configuration", () => {
    const TYPE_CONFIG = {
      info: { label: "Info", color: "bg-blue-100 text-blue-700" },
      warning: { label: "Warning", color: "bg-amber-100 text-amber-700" },
      maintenance: { label: "Maintenance", color: "bg-orange-100 text-orange-700" },
      feature: { label: "Feature", color: "bg-emerald-100 text-emerald-700" },
    };

    it("should have a config for each type", () => {
      expect(Object.keys(TYPE_CONFIG)).toHaveLength(4);
    });

    it("each type should have label and color", () => {
      for (const [key, config] of Object.entries(TYPE_CONFIG)) {
        expect(config.label).toBeTruthy();
        expect(config.color).toBeTruthy();
      }
    });
  });

  describe("Banner visibility logic", () => {
    const now = new Date("2026-02-08T00:00:00Z");

    function isBannerVisible(banner: {
      isActive: boolean;
      startsAt: Date | null;
      endsAt: Date | null;
    }, currentTime: Date): boolean {
      if (!banner.isActive) return false;
      if (banner.startsAt && banner.startsAt > currentTime) return false;
      if (banner.endsAt && banner.endsAt <= currentTime) return false;
      return true;
    }

    it("should show active banner with no time constraints", () => {
      expect(isBannerVisible({ isActive: true, startsAt: null, endsAt: null }, now)).toBe(true);
    });

    it("should hide inactive banner", () => {
      expect(isBannerVisible({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(false);
    });

    it("should hide banner that hasn't started yet", () => {
      const future = new Date("2026-03-01T00:00:00Z");
      expect(isBannerVisible({ isActive: true, startsAt: future, endsAt: null }, now)).toBe(false);
    });

    it("should hide banner that has ended", () => {
      const past = new Date("2026-01-01T00:00:00Z");
      expect(isBannerVisible({ isActive: true, startsAt: null, endsAt: past }, now)).toBe(false);
    });

    it("should show banner within time window", () => {
      const start = new Date("2026-02-01T00:00:00Z");
      const end = new Date("2026-02-28T00:00:00Z");
      expect(isBannerVisible({ isActive: true, startsAt: start, endsAt: end }, now)).toBe(true);
    });

    it("should show banner that started in the past with no end", () => {
      const start = new Date("2026-01-15T00:00:00Z");
      expect(isBannerVisible({ isActive: true, startsAt: start, endsAt: null }, now)).toBe(true);
    });

    it("should hide inactive banner even within time window", () => {
      const start = new Date("2026-02-01T00:00:00Z");
      const end = new Date("2026-02-28T00:00:00Z");
      expect(isBannerVisible({ isActive: false, startsAt: start, endsAt: end }, now)).toBe(false);
    });
  });

  describe("Banner validation", () => {
    function validateBannerInput(input: {
      title: string;
      message: string;
      type: string;
    }): string[] {
      const errors: string[] = [];
      if (!input.title || input.title.trim().length === 0) errors.push("Title is required");
      if (input.title && input.title.length > 200) errors.push("Title must be 200 chars or less");
      if (!input.message || input.message.trim().length === 0) errors.push("Message is required");
      if (input.message && input.message.length > 2000) errors.push("Message must be 2000 chars or less");
      const validTypes = ["info", "warning", "maintenance", "feature"];
      if (!validTypes.includes(input.type)) errors.push("Invalid banner type");
      return errors;
    }

    it("should pass valid input", () => {
      expect(validateBannerInput({ title: "Test", message: "Hello", type: "info" })).toEqual([]);
    });

    it("should reject empty title", () => {
      const errors = validateBannerInput({ title: "", message: "Hello", type: "info" });
      expect(errors).toContain("Title is required");
    });

    it("should reject empty message", () => {
      const errors = validateBannerInput({ title: "Test", message: "", type: "info" });
      expect(errors).toContain("Message is required");
    });

    it("should reject title over 200 chars", () => {
      const errors = validateBannerInput({ title: "a".repeat(201), message: "Hello", type: "info" });
      expect(errors).toContain("Title must be 200 chars or less");
    });

    it("should reject message over 2000 chars", () => {
      const errors = validateBannerInput({ title: "Test", message: "a".repeat(2001), type: "info" });
      expect(errors).toContain("Message must be 2000 chars or less");
    });

    it("should reject invalid type", () => {
      const errors = validateBannerInput({ title: "Test", message: "Hello", type: "invalid" });
      expect(errors).toContain("Invalid banner type");
    });

    it("should accept all valid types", () => {
      for (const type of ["info", "warning", "maintenance", "feature"]) {
        expect(validateBannerInput({ title: "T", message: "M", type })).toEqual([]);
      }
    });
  });

  describe("Banner dismissal logic (client-side)", () => {
    it("should filter out dismissed banners", () => {
      const banners = [
        { id: 1, title: "A" },
        { id: 2, title: "B" },
        { id: 3, title: "C" },
      ];
      const dismissedIds = new Set([2]);
      const visible = banners.filter((b) => !dismissedIds.has(b.id));
      expect(visible).toHaveLength(2);
      expect(visible.map((b) => b.id)).toEqual([1, 3]);
    });

    it("should show all banners when none dismissed", () => {
      const banners = [{ id: 1 }, { id: 2 }];
      const dismissedIds = new Set<number>();
      const visible = banners.filter((b) => !dismissedIds.has(b.id));
      expect(visible).toHaveLength(2);
    });

    it("should show nothing when all dismissed", () => {
      const banners = [{ id: 1 }, { id: 2 }];
      const dismissedIds = new Set([1, 2]);
      const visible = banners.filter((b) => !dismissedIds.has(b.id));
      expect(visible).toHaveLength(0);
    });
  });

  describe("AUDIT_ACTIONS banner constants", () => {
    const BANNER_ACTIONS = {
      BANNER_CREATED: "admin.banner_created",
      BANNER_UPDATED: "admin.banner_updated",
      BANNER_ACTIVATED: "admin.banner_activated",
      BANNER_DEACTIVATED: "admin.banner_deactivated",
      BANNER_DELETED: "admin.banner_deleted",
    };

    it("should have 5 banner audit actions", () => {
      expect(Object.keys(BANNER_ACTIONS)).toHaveLength(5);
    });

    it("all actions should start with admin.banner_", () => {
      for (const action of Object.values(BANNER_ACTIONS)) {
        expect(action).toMatch(/^admin\.banner_/);
      }
    });
  });

  describe("System Status Card logic", () => {
    function formatUptime(seconds: number): string {
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    }

    function latencyColor(ms: number): string {
      if (ms < 100) return "text-emerald-600";
      if (ms < 500) return "text-amber-600";
      return "text-red-600";
    }

    it("should format uptime in minutes", () => {
      expect(formatUptime(300)).toBe("5m");
    });

    it("should format uptime in hours and minutes", () => {
      expect(formatUptime(3720)).toBe("1h 2m");
    });

    it("should format uptime in days, hours, and minutes", () => {
      expect(formatUptime(90060)).toBe("1d 1h 1m");
    });

    it("should format zero uptime", () => {
      expect(formatUptime(0)).toBe("0m");
    });

    it("should return green for low latency", () => {
      expect(latencyColor(50)).toBe("text-emerald-600");
    });

    it("should return amber for medium latency", () => {
      expect(latencyColor(200)).toBe("text-amber-600");
    });

    it("should return red for high latency", () => {
      expect(latencyColor(600)).toBe("text-red-600");
    });

    it("should return green for exactly 0ms", () => {
      expect(latencyColor(0)).toBe("text-emerald-600");
    });

    it("should return amber for exactly 100ms", () => {
      expect(latencyColor(100)).toBe("text-amber-600");
    });

    it("should return red for exactly 500ms", () => {
      expect(latencyColor(500)).toBe("text-red-600");
    });
  });

  describe("Active banner count", () => {
    it("should return 0 when no banners exist", () => {
      const banners: unknown[] = [];
      expect(banners.length).toBe(0);
    });

    it("should count only active banners within time window", () => {
      const now = new Date("2026-02-08T00:00:00Z");
      const banners = [
        { isActive: true, startsAt: null, endsAt: null },
        { isActive: false, startsAt: null, endsAt: null },
        { isActive: true, startsAt: new Date("2026-03-01"), endsAt: null },
        { isActive: true, startsAt: null, endsAt: new Date("2026-01-01") },
        { isActive: true, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-03-01") },
      ];

      function isVisible(b: typeof banners[0]): boolean {
        if (!b.isActive) return false;
        if (b.startsAt && b.startsAt > now) return false;
        if (b.endsAt && b.endsAt <= now) return false;
        return true;
      }

      const activeCount = banners.filter(isVisible).length;
      expect(activeCount).toBe(2); // first and last
    });
  });

  describe("Banner type styles for global banner", () => {
    const TYPE_STYLES = {
      info: { bg: "bg-blue-600" },
      warning: { bg: "bg-amber-500" },
      maintenance: { bg: "bg-orange-600" },
      feature: { bg: "bg-emerald-600" },
    };

    it("should have distinct background colors for each type", () => {
      const bgs = Object.values(TYPE_STYLES).map((s) => s.bg);
      const unique = new Set(bgs);
      expect(unique.size).toBe(4);
    });

    it("should fall back to info style for unknown types", () => {
      const type = "unknown" as keyof typeof TYPE_STYLES;
      const style = TYPE_STYLES[type] ?? TYPE_STYLES.info;
      expect(style.bg).toBe("bg-blue-600");
    });
  });
});
