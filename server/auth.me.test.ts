import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const AUTH_ME_KEYS = [
  "name",
  "email",
  "avatarUrl",
  "authProvider",
  "role",
  "approved",
  "canvasIntroSeen",
] as const;

function createContext(user: User | null): TrpcContext {
  return {
    user,
    req: {
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    correlationId: "auth-me-projection-test",
  };
}

function fullUserRow(): User {
  const now = new Date("2026-07-25T00:00:00.000Z");

  return {
    id: 41,
    openId: "server-only-open-id",
    name: "Projection Test",
    displayName: "Server-only display name",
    email: "projection@example.com",
    avatarUrl: "https://images.example/avatar.png",
    avatarKey: "server-only/avatar-key",
    bannerUrl: "https://images.example/banner.png",
    bannerKey: "server-only/banner-key",
    bio: "Server-only bio",
    loginMethod: "email",
    role: "moderator",
    storageUsed: 1234,
    storageLimit: 5678,
    suspendedAt: null,
    suspendedReason: "server-only suspension reason",
    suspendedBy: 2,
    frozenAt: null,
    frozenReason: "server-only freeze reason",
    frozenBy: "system",
    referralCode: "SERVER-ONLY",
    referredByUserId: 3,
    approved: true,
    accessCode: "server-only-access-code",
    approvedAt: now,
    passwordHash: "server-only-password-hash",
    authProvider: "email",
    emailVerified: true,
    emailVerificationToken: "server-only-verification-token",
    emailVerificationExpiresAt: now,
    failedLoginAttempts: 4,
    lockedUntil: now,
    canvasIntroSeen: true,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

describe("auth.me projection", () => {
  it("returns only the explicitly approved client fields", async () => {
    const result = await appRouter.createCaller(createContext(fullUserRow())).auth.me();

    expect(result).toEqual({
      name: "Projection Test",
      email: "projection@example.com",
      avatarUrl: "https://images.example/avatar.png",
      authProvider: "email",
      role: "moderator",
      approved: true,
      canvasIntroSeen: true,
    });
    expect(Object.keys(result ?? {})).toEqual(AUTH_ME_KEYS);
    expect(JSON.stringify(result)).not.toContain("server-only");
  });

  it("returns null for an unauthenticated request", async () => {
    await expect(appRouter.createCaller(createContext(null)).auth.me()).resolves.toBeNull();
  });
});
