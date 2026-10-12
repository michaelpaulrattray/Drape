/**
 * TOO MANY WRONG ACCESS CODES IS A REAL REFUSAL, NOT A 200 (#2371).
 *
 * Until #2371 both access-code procedures answered their rate limit as an
 * ordinary result — `{ valid: false, error: "Too many attempts…" }` and
 * `{ success: false, error: … }` — which invariant 6 forbids: a client cannot
 * tell it from "this code is not valid", and there is no wait to show.
 *
 * Driven through the REAL `appRouter` and the REAL in-memory limiter; only the
 * database readers behind each procedure are stubbed, because what is under
 * test is what happens BEFORE them. Each procedure gets its positive control
 * (calls inside the window reach the database and answer normally) beside the
 * refusal (the first call past the window throws and never reaches it).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";

vi.mock("./db/validateInviteCode", () => ({
  validateInviteCode: vi.fn(async () => ({ valid: false, error: "Invalid access code." })),
}));
vi.mock("./db/inviteCodes", () => ({
  redeemInviteCode: vi.fn(async () => ({ success: false, error: "Invalid access code." })),
}));
vi.mock("./auditLog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auditLog")>()),
  logAuditEvent: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";
import { redeemInviteCode } from "./db/inviteCodes";
import { validateInviteCode } from "./db/validateInviteCode";

let seq = 0;

function publicCtx(ip: string): TrpcContext {
  return {
    correlationId: "access-rate-limit-2371",
    user: null,
    req: { headers: {}, ip, protocol: "https" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function unapprovedCtx(id: number): TrpcContext {
  return {
    correlationId: "access-rate-limit-2371",
    user: {
      id,
      openId: `access-rl-${id}`,
      email: `access-rl-${id}@example.com`,
      name: "Test",
      role: "user",
      approved: false,
      suspendedAt: null,
      lockedUntil: null,
      frozenAt: null,
    } as unknown as NonNullable<TrpcContext["user"]>,
    req: { headers: {}, ip: "10.0.0.1", protocol: "https" } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const REFUSAL = /^Too many attempts\. Try again in (a minute|\d+ minutes)\.$/;

describe("#2371 — access.validate past its window", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers the first ten as ordinary results, then throws TOO_MANY_REQUESTS", async () => {
    const caller = appRouter.createCaller(publicCtx(`198.51.100.${++seq}`));

    /* POSITIVE CONTROL — inside the window the database is asked and the
       answer is a normal one; a limiter that refused everything fails here. */
    for (let i = 0; i < 10; i++) {
      await expect(caller.access.validate({ code: "DRAPE-WRONG" })).resolves.toEqual({
        valid: false,
        error: "Invalid access code.",
      });
    }
    expect(validateInviteCode).toHaveBeenCalledTimes(10);

    /* The eleventh is a real refusal, says when, and never reaches the db. */
    const refusal = await caller.access.validate({ code: "DRAPE-WRONG" }).then(
      (answer) => ({ answered: answer }),
      (error: { code?: string; message?: string }) => error,
    );
    expect(refusal).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect((refusal as { message: string }).message).toMatch(REFUSAL);
    expect(validateInviteCode).toHaveBeenCalledTimes(10);
  });
});

describe("#2371 — access.redeem past its window", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers the first five as ordinary results, then throws TOO_MANY_REQUESTS", async () => {
    const caller = appRouter.createCaller(unapprovedCtx(910_000 + ++seq));

    for (let i = 0; i < 5; i++) {
      await expect(caller.access.redeem({ code: "DRAPE-WRONG" })).resolves.toEqual({
        success: false,
        error: "Invalid access code.",
      });
    }
    expect(redeemInviteCode).toHaveBeenCalledTimes(5);

    const refusal = await caller.access.redeem({ code: "DRAPE-WRONG" }).then(
      (answer) => ({ answered: answer }),
      (error: { code?: string; message?: string }) => error,
    );
    expect(refusal).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect((refusal as { message: string }).message).toMatch(REFUSAL);
    expect(redeemInviteCode).toHaveBeenCalledTimes(5);
  });
});
