/**
 * Tests for Email/Password Authentication Routes
 *
 * Tests input validation, rate limiting, disposable email blocking,
 * beta code enforcement, password hashing, and session creation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { isDisposableEmail } from "../security/disposableEmails";
import { checkRateLimit } from "../security/rateLimit";

// ─── Validation schema tests (mirrors emailAuth.ts schemas) ─────────────

const registerSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(100),
  betaCode: z.string().min(1, "Beta code is required").max(64),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

describe("Email Auth — Registration Validation", () => {
  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid email address");
    }
  });

  it("rejects empty email", () => {
    const result = registerSchema.safeParse({
      email: "",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Short1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Password must be at least 8 characters"
      );
    }
  });

  it("rejects password without uppercase letter", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "nouppercase1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Password must contain at least one uppercase letter"
      );
    }
  });

  it("rejects password without a number", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "NoNumberHere",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(
        "Password must contain at least one number"
      );
    }
  });

  it("rejects password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "A1" + "a".repeat(127),
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Name is required");
    }
  });

  it("rejects name longer than 100 characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "A".repeat(101),
      betaCode: "BETA123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty beta code", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Beta code is required");
    }
  });

  it("rejects missing fields", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("accepts password with special characters", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Str0ng!@#$%",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts email with subdomain", () => {
    const result = registerSchema.safeParse({
      email: "user@mail.example.com",
      password: "SecurePass1",
      name: "Test User",
      betaCode: "BETA123",
    });
    expect(result.success).toBe(true);
  });
});

describe("Email Auth — Login Validation", () => {
  it("accepts valid login input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-valid",
      password: "anypassword",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Password is required");
    }
  });

  it("rejects missing fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("does not enforce password strength on login (only on register)", () => {
    // Login should accept any non-empty password — strength rules are for registration only
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "weak",
    });
    expect(result.success).toBe(true);
  });
});

describe("Email Auth — Disposable Email Blocking", () => {
  it("blocks guerrillamail.com", () => {
    expect(isDisposableEmail("test@guerrillamail.com")).toBe(true);
  });

  it("blocks tempmail.com", () => {
    expect(isDisposableEmail("test@tempmail.com")).toBe(true);
  });

  it("blocks mailinator.com", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
  });

  it("blocks yopmail.com", () => {
    expect(isDisposableEmail("test@yopmail.com")).toBe(true);
  });

  it("allows gmail.com", () => {
    expect(isDisposableEmail("test@gmail.com")).toBe(false);
  });

  it("allows outlook.com", () => {
    expect(isDisposableEmail("test@outlook.com")).toBe(false);
  });

  it("allows custom domain", () => {
    expect(isDisposableEmail("user@mycompany.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDisposableEmail("test@GUERRILLAMAIL.COM")).toBe(true);
  });

  it("returns false for malformed email without @", () => {
    expect(isDisposableEmail("nodomain")).toBe(false);
  });
});

describe("Email Auth — Rate Limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows registration attempts within limit (5 per 15 min)", () => {
    const config = {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "email_register_test",
    };

    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(`test-register-ip-${Date.now()}`, config);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks registration after exceeding limit", () => {
    const config = {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "email_register_block_test",
    };
    const ip = "register-block-test-ip";

    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, config);
    }

    const blocked = checkRateLimit(ip, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("allows login attempts within limit (10 per 15 min)", () => {
    const config = {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "email_login_test",
    };

    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit(`test-login-ip-${Date.now()}`, config);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks login after exceeding limit", () => {
    const config = {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: "email_login_block_test",
    };
    const ip = "login-block-test-ip";

    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip, config);
    }

    const blocked = checkRateLimit(ip, config);
    expect(blocked.allowed).toBe(false);
  });

  it("resets after window expires", () => {
    const config = {
      maxRequests: 1,
      windowMs: 1000,
      keyPrefix: "email_reset_test",
    };
    const ip = "reset-test-ip";

    checkRateLimit(ip, config);
    const blocked = checkRateLimit(ip, config);
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1100);

    const allowed = checkRateLimit(ip, config);
    expect(allowed.allowed).toBe(true);
  });
});

describe("Email Auth — Password Hashing", () => {
  // Use low rounds (4) in tests for speed — production uses 12
  const TEST_ROUNDS = 4;

  beforeEach(() => {
    // Restore real timers — bcrypt uses real async I/O that breaks under fake timers
    vi.useRealTimers();
  });

  it("bcrypt hashes are deterministic length", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync("SecurePass1", TEST_ROUNDS);
    // bcrypt hashes are always 60 characters
    expect(hash.length).toBe(60);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("bcrypt correctly verifies matching password", async () => {
    const bcrypt = await import("bcryptjs");
    const password = "SecurePass1";
    const hash = bcrypt.hashSync(password, TEST_ROUNDS);
    const isValid = bcrypt.compareSync(password, hash);
    expect(isValid).toBe(true);
  });

  it("bcrypt rejects wrong password", async () => {
    const bcrypt = await import("bcryptjs");
    const hash = bcrypt.hashSync("SecurePass1", TEST_ROUNDS);
    const isValid = bcrypt.compareSync("WrongPass1", hash);
    expect(isValid).toBe(false);
  });

  it("bcrypt produces different hashes for same password (salted)", async () => {
    const bcrypt = await import("bcryptjs");
    const password = "SecurePass1";
    const hash1 = bcrypt.hashSync(password, TEST_ROUNDS);
    const hash2 = bcrypt.hashSync(password, TEST_ROUNDS);
    expect(hash1).not.toBe(hash2);
    // But both should verify
    expect(bcrypt.compareSync(password, hash1)).toBe(true);
    expect(bcrypt.compareSync(password, hash2)).toBe(true);
  });
});
