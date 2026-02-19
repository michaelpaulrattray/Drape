import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock dependencies ─────────────────────────────────────────────────────
vi.mock("./db/validateInviteCode", () => ({
  validateInviteCode: vi.fn(),
}));

vi.mock("./security/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { validateInviteCode } from "./db/validateInviteCode";
import { checkRateLimit } from "./security/rateLimit";

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: { cookie: "" }, ip: "127.0.0.1" } as any,
    res: {} as any,
  };
}

describe("access.validate (public endpoint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as any).mockReturnValue({ allowed: true, remaining: 9 });
  });

  it("returns valid: true for a valid code", async () => {
    (validateInviteCode as any).mockResolvedValue({ valid: true });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "DRAPE-TESTCODE" });

    expect(result.valid).toBe(true);
    expect(validateInviteCode).toHaveBeenCalledWith("DRAPE-TESTCODE");
  });

  it("returns valid: false with error for invalid code", async () => {
    (validateInviteCode as any).mockResolvedValue({
      valid: false,
      error: "Invalid access code.",
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "BAD-CODE" });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid access code.");
  });

  it("returns valid: false for expired code", async () => {
    (validateInviteCode as any).mockResolvedValue({
      valid: false,
      error: "This access code has expired.",
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "EXPIRED-CODE" });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("returns valid: false for deactivated code", async () => {
    (validateInviteCode as any).mockResolvedValue({
      valid: false,
      error: "This access code has been deactivated.",
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "DEACTIVATED" });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("deactivated");
  });

  it("returns valid: false for usage-limit-reached code", async () => {
    (validateInviteCode as any).mockResolvedValue({
      valid: false,
      error: "This access code has reached its usage limit.",
    });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "MAXED-OUT" });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("usage limit");
  });

  it("rejects empty code input", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(caller.access.validate({ code: "" })).rejects.toThrow();
  });

  it("enforces rate limiting", async () => {
    (checkRateLimit as any).mockReturnValue({ allowed: false, remaining: 0 });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "DRAPE-RATELIMIT" });

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Too many attempts");
    expect(validateInviteCode).not.toHaveBeenCalled();
  });

  it("does not require authentication (ctx.user is null)", async () => {
    (validateInviteCode as any).mockResolvedValue({ valid: true });

    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.access.validate({ code: "DRAPE-PUBLIC" });

    expect(result.valid).toBe(true);
  });
});
