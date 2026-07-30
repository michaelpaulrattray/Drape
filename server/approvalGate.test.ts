import fs from "node:fs";
import path from "node:path";
import { TRPCError, initTRPC } from "@trpc/server";
import { describe, expect, it } from "vitest";

/**
 * The beta approval gate (CLAUDE.md "Currently not enforced" → enforced).
 *
 * The rule: "Unapproved accounts are intended to be able to sign in and redeem
 * an access code, and nothing else." Until this change it held only on the two
 * login screens and in the UI — every protected procedure accepted any
 * signed-in account, so the gate was decoration.
 *
 * These tests prove the middleware *blocks* (invariant 7: a control that is
 * not invoked does not exist, and a test must prove it refuses), and equally
 * that it does not block the two things approval itself depends on. A gate
 * that locked an unapproved account out of code redemption would make approval
 * unreachable.
 */

type TestUser = {
  id: number;
  approved: boolean;
  suspendedAt: Date | null;
  lockedUntil: Date | null;
};

/**
 * Rebuilds the middleware chain against the same rules the real one uses.
 * The composition itself — which builder each procedure is declared with — is
 * pinned by the source assertions at the bottom, which is what actually stops
 * a regression.
 */
function buildHarness() {
  const t = initTRPC.context<{ user: TestUser | null }>().create();

  const requireUser = t.middleware(({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    if (ctx.user.suspendedAt) throw new TRPCError({ code: "FORBIDDEN", message: "suspended" });
    if (ctx.user.lockedUntil && ctx.user.lockedUntil > new Date()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "locked" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

  const requireApproved = t.middleware(({ ctx, next }) => {
    if (!ctx.user?.approved) {
      throw new TRPCError({ code: "FORBIDDEN", message: "awaiting approval" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

  const protectedProcedure = t.procedure.use(requireUser).use(requireApproved);
  const onboardingProcedure = t.procedure.use(requireUser);

  const appRouter = t.router({
    somethingProtected: protectedProcedure.query(() => "ran"),
    redeem: onboardingProcedure.mutation(() => "redeemed"),
    status: onboardingProcedure.query(({ ctx }) => ({ approved: ctx.user.approved })),
    publicThing: t.procedure.query(() => "public"),
  });

  return (user: TestUser | null) => appRouter.createCaller({ user });
}

const caller = buildHarness();

const APPROVED: TestUser = { id: 1, approved: true, suspendedAt: null, lockedUntil: null };
const UNAPPROVED: TestUser = { id: 2, approved: false, suspendedAt: null, lockedUntil: null };

describe("approval gate — what it blocks", () => {
  it("refuses a protected procedure for a signed-in but unapproved account", async () => {
    await expect(caller(UNAPPROVED).somethingProtected()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("still refuses anonymous callers as UNAUTHORIZED, not FORBIDDEN", async () => {
    // The distinction matters: the client redirects to login on UNAUTHORIZED.
    await expect(caller(null).somethingProtected()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps suspension and lockout ahead of approval", async () => {
    const suspended = { ...APPROVED, suspendedAt: new Date() };
    await expect(caller(suspended).somethingProtected()).rejects.toMatchObject({
      message: "suspended",
    });

    const locked = { ...APPROVED, lockedUntil: new Date(Date.now() + 60_000) };
    await expect(caller(locked).somethingProtected()).rejects.toMatchObject({
      message: "locked",
    });

    // …and a suspended account is refused on the onboarding surface too, so
    // the exemption cannot be used to sidestep suspension.
    await expect(caller(suspended).redeem()).rejects.toMatchObject({ message: "suspended" });
  });

  it("lets an approved account through unchanged", async () => {
    await expect(caller(APPROVED).somethingProtected()).resolves.toBe("ran");
  });
});

describe("approval gate — what it must NOT block", () => {
  it("lets an unapproved account redeem an access code", async () => {
    // Gating this would make approval unreachable: the account could never
    // redeem the code that approves it.
    await expect(caller(UNAPPROVED).redeem()).resolves.toBe("redeemed");
  });

  it("lets an unapproved account read its own access status", async () => {
    await expect(caller(UNAPPROVED).status()).resolves.toEqual({ approved: false });
  });

  it("leaves public procedures reachable without a session", async () => {
    // auth.me and auth.logout are publicProcedure, so signing in and seeing
    // your own session were never behind this gate at all.
    await expect(caller(null).publicThing()).resolves.toBe("public");
  });
});

describe("approval gate — composition is what it claims", () => {
  const serverRoot = __dirname;
  const trpcSource = fs.readFileSync(path.join(serverRoot, "_core", "trpc.ts"), "utf8");
  const accessSource = fs.readFileSync(path.join(serverRoot, "routes", "access.ts"), "utf8");
  const authSource = fs.readFileSync(path.join(serverRoot, "routes", "auth.ts"), "utf8");

  it("puts the approval check on protectedProcedure", () => {
    expect(trpcSource).toMatch(
      /export const protectedProcedure = t\.procedure\.use\(requireUser\)\.use\(requireApproved\)/,
    );
  });

  it("keeps onboardingProcedure free of the approval check", () => {
    expect(trpcSource).toMatch(/export const onboardingProcedure = t\.procedure\.use\(requireUser\)/);
  });

  it("exempts exactly redeem and status — the enumerated list", () => {
    const exempt = [...accessSource.matchAll(/(\w+):\s*onboardingProcedure/g)].map((m) => m[1]);
    expect(exempt.sort()).toEqual(["redeem", "status"]);

    // Nothing outside the access router may use the exempt builder without a
    // deliberate decision; this list is the decision.
    const allFiles = fs
      .readdirSync(path.join(serverRoot, "routes"), { recursive: true, encoding: "utf8" })
      .filter((file) => typeof file === "string" && file.endsWith(".ts"));
    const users = allFiles.filter((file) =>
      fs
        .readFileSync(path.join(serverRoot, "routes", file), "utf8")
        .includes("onboardingProcedure"),
    );
    expect(users).toEqual(["access.ts"]);
  });

  it("keeps sign-in and session reads public", () => {
    // If these ever moved to protectedProcedure they would fall behind the
    // gate, and an unapproved user could not even discover their own state.
    expect(authSource).toMatch(/me:\s*publicProcedure/);
    expect(authSource).toMatch(/logout:\s*publicProcedure/);
  });
});
