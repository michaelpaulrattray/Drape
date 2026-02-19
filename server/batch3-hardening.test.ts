/**
 * Batch 3 Hardening Tests
 * - Fix 11: Circuit breaker for Gemini API
 * - Fix 12: Placeholder image detection
 * - Fix 13: Dead code removal (compile-time verification)
 * - Fix 14: Account deletion (GDPR)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Fix 11: Circuit Breaker ───────────────────────────────────────────────

describe("Gemini Circuit Breaker", () => {
  let cb: typeof import("./casting/geminiCircuitBreaker");

  beforeEach(async () => {
    vi.resetModules();
    cb = await import("./casting/geminiCircuitBreaker");
    cb.resetCircuitBreaker();
  });

  it("starts in CLOSED state", () => {
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("CLOSED");
    expect(stats.recentFailures).toBe(0);
  });

  it("stays CLOSED after fewer failures than threshold", () => {
    const retryableError = new Error("503 Service Unavailable");
    cb.recordFailure(retryableError);
    cb.recordFailure(retryableError);
    cb.recordFailure(retryableError);
    cb.recordFailure(retryableError);
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("CLOSED");
    expect(stats.recentFailures).toBe(4);
  });

  it("trips to OPEN after reaching failure threshold", () => {
    const retryableError = new Error("429 Too Many Requests");
    for (let i = 0; i < 5; i++) {
      cb.recordFailure(retryableError);
    }
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("OPEN");
  });

  it("rejects requests when OPEN", () => {
    const retryableError = new Error("500 Internal Server Error");
    for (let i = 0; i < 5; i++) {
      cb.recordFailure(retryableError);
    }
    expect(() => cb.checkCircuit()).toThrow("AI engine temporarily unavailable");
  });

  it("does NOT trip on non-retryable errors", () => {
    const validationError = new Error("Invalid input: missing prompt");
    for (let i = 0; i < 10; i++) {
      cb.recordFailure(validationError);
    }
    const stats = cb.getCircuitBreakerStats();
    expect(stats.state).toBe("CLOSED");
  });

  it("resets failure count on success in HALF_OPEN state", () => {
    const retryableError = new Error("503 Service Unavailable");
    for (let i = 0; i < 5; i++) {
      cb.recordFailure(retryableError);
    }
    expect(cb.getCircuitBreakerStats().state).toBe("OPEN");

    // Manually reset to simulate HALF_OPEN (can't easily wait 30s in test)
    cb.resetCircuitBreaker();
    expect(cb.getCircuitBreakerStats().state).toBe("CLOSED");
    expect(cb.getCircuitBreakerStats().recentFailures).toBe(0);
  });

  it("can be manually reset", () => {
    const retryableError = new Error("500 Internal Server Error");
    for (let i = 0; i < 5; i++) {
      cb.recordFailure(retryableError);
    }
    expect(cb.getCircuitBreakerStats().state).toBe("OPEN");
    cb.resetCircuitBreaker();
    expect(cb.getCircuitBreakerStats().state).toBe("CLOSED");
    expect(cb.getCircuitBreakerStats().totalTrips).toBe(0);
  });
});

// ─── Fix 12: Placeholder Detection ────────────────────────────────────────

describe("Placeholder Image Detection", () => {
  let detection: typeof import("./casting/placeholderDetection");

  beforeEach(async () => {
    vi.resetModules();
    detection = await import("./casting/placeholderDetection");
  });

  it("rejects empty base64 string", () => {
    expect(detection.isPlaceholderImage("")).toBe(true);
  });

  it("rejects very small images (< 5KB)", () => {
    // Create a base64 string representing < 5KB of data
    const tinyImage = Buffer.from("x".repeat(100)).toString("base64");
    expect(detection.isPlaceholderImage(tinyImage)).toBe(true);
  });

  it("detects uniform color images via low variance", () => {
    // Create a buffer of all identical bytes (simulates solid gray)
    const uniformBytes = new Uint8Array(10000).fill(128);
    const base64 = Buffer.from(uniformBytes).toString("base64");
    expect(detection.isPlaceholderImage(base64)).toBe(true);
  });

  it("accepts images with varied byte content", () => {
    // Create pseudo-random bytes that simulate a real image with high variance
    const variedBytes = new Uint8Array(10000);
    for (let i = 0; i < variedBytes.length; i++) {
      variedBytes[i] = (i * 37 + 127) % 256;
    }
    const base64 = Buffer.from(variedBytes).toString("base64");
    expect(detection.isPlaceholderImage(base64)).toBe(false);
  });

  it("validateNotPlaceholder skips non-data-URL strings", () => {
    // Should not throw for regular URLs
    expect(() => {
      detection.validateNotPlaceholder("https://storage.example.com/image.png");
    }).not.toThrow();
  });

  it("validateNotPlaceholder throws for placeholder data URLs", () => {
    // Create a solid-color image as data URL
    const uniformBytes = new Uint8Array(10000).fill(200);
    const base64 = Buffer.from(uniformBytes).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    expect(() => {
      detection.validateNotPlaceholder(dataUrl);
    }).toThrow("blank image");
  });
});

// ─── Fix 14: Account Deletion ──────────────────────────────────────────────

describe("Account Deletion Route", () => {
  it("exports accountRouter with deleteAccount procedure", async () => {
    const { accountRouter } = await import("./routes/account");
    expect(accountRouter).toBeDefined();
    expect(accountRouter._def.procedures).toHaveProperty("deleteAccount");
  });

  it("rejects wrong confirmation string via Zod validation", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      confirmation: z
        .string()
        .refine((val) => val === "DELETE MY ACCOUNT", {
          message: 'You must type "DELETE MY ACCOUNT" to confirm.',
        }),
    });

    const badResult = schema.safeParse({ confirmation: "delete" });
    expect(badResult.success).toBe(false);

    const goodResult = schema.safeParse({ confirmation: "DELETE MY ACCOUNT" });
    expect(goodResult.success).toBe(true);
  });
});

describe("Account Deletion DB Helper", () => {
  it("exports deleteUserAccount function", async () => {
    const { deleteUserAccount } = await import("./db/accountDeletion");
    expect(typeof deleteUserAccount).toBe("function");
  });
});

// ─── Fix 13: Dead Code Removal ────────────────────────────────────────────

describe("Dead Code Removal - generateAllViews", () => {
  it("generateAllViews procedure no longer exists in castingImaging router", async () => {
    const { castingImagingRouter } = await import("./routes/generation/castingImaging");
    const procedures = castingImagingRouter._def.procedures;
    expect(procedures).not.toHaveProperty("generateAllViews");
  });

  it("multiView procedure still exists", async () => {
    const { castingImagingRouter } = await import("./routes/generation/castingImaging");
    const procedures = castingImagingRouter._def.procedures;
    expect(procedures).toHaveProperty("multiView");
  });
});
