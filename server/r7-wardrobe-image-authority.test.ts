import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createSession: vi.fn(),
    capUserSessions: vi.fn(),
    getSessionById: vi.fn(),
  };
});

vi.mock("./casting/snapshotReadScope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./casting/snapshotReadScope")>();
  return {
    ...actual,
    captureSnapshotReadMode: vi.fn(),
  };
});

vi.mock("./casting/effectiveCastRead", () => ({
  resolveEffectiveCastStateForRead: vi.fn(),
  resolveEffectiveCastStatesForRead: vi.fn(),
}));

vi.mock("./wardrobe/vtoSession", () => ({
  seedSession: vi.fn(),
  clearSession: vi.fn(),
}));

import {
  capUserSessions,
  createSession,
  getSessionById,
} from "./db";
import { captureSnapshotReadMode } from "./casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "./casting/effectiveCastRead";
import { seedSession } from "./wardrobe/vtoSession";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;
const originalR2PublicUrl = process.env.R2_PUBLIC_URL;

function authCtx(userId = 7): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `wardrobe-user-${userId}`,
    email: `wardrobe-${userId}@example.com`,
    name: "Wardrobe User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function currentState(fullBodyUrl = "https://selected.example/front-full.png") {
  return {
    status: "current",
    selectedViews: [
      {
        angle: "frontClose",
        asset: { storageUrl: "https://selected.example/front-close.png" },
      },
      {
        angle: "frontFull",
        asset: { storageUrl: fullBodyUrl },
      },
    ],
  } as Awaited<ReturnType<typeof resolveEffectiveCastStateForRead>>;
}

describe("R7-7B5 Wardrobe session image authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    vi.mocked(captureSnapshotReadMode).mockReturnValue("r6");
    vi.mocked(createSession).mockResolvedValue(91);
    vi.mocked(capUserSessions).mockResolvedValue(undefined);
    vi.mocked(seedSession).mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalR2PublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = originalR2PublicUrl;
  });

  it("persists the selected full-body view for a snapshot-linked session", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState("https://selected.example/cast-body.png"),
    );

    const result = await appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelId: 42,
      modelImageUrl: "https://forged.example/not-the-cast.png",
    });

    expect(result).toEqual({ sessionId: 91 });
    expect(captureSnapshotReadMode).toHaveBeenCalledTimes(1);
    expect(captureSnapshotReadMode).toHaveBeenCalledWith(7);
    expect(resolveEffectiveCastStateForRead).toHaveBeenCalledWith({
      userId: 7,
      modelId: 42,
    });
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      modelId: 42,
      modelImageUrl: "https://selected.example/cast-body.png",
    }));
  });

  it("refuses a linked session without a selected full-body view", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue({
      status: "current",
      selectedViews: [{
        angle: "frontClose",
        asset: { storageUrl: "https://selected.example/front-close.png" },
      }],
    } as Awaited<ReturnType<typeof resolveEffectiveCastStateForRead>>);

    await expect(appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelId: 42,
      modelImageUrl: "https://forged.example/not-the-cast.png",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(createSession).not.toHaveBeenCalled();
  });

  it("keeps an upload-only session independent in snapshot mode", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");

    await appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelImageUrl: "https://pub-test.r2.dev/7-models/upload-owned-model.png",
    });

    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      modelId: null,
      modelImageUrl: "https://pub-test.r2.dev/7-models/upload-owned-model.png",
    }));
  });

  it("refuses a model-less session URL outside the user's upload namespace", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");

    await expect(appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelImageUrl: "https://pub-test.r2.dev/99-models/upload-foreign.png",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(createSession).not.toHaveBeenCalled();
  });

  it("preserves the R6 client URL contract while scope is off", async () => {
    await appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelId: 42,
      modelImageUrl: "https://legacy.example/model.png",
    });

    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 42,
      modelImageUrl: "https://legacy.example/model.png",
    }));
  });

  it("rejects client-supplied read authority before the handler runs", async () => {
    await expect(appRouter.createCaller(authCtx()).wardrobe.sessions.create({
      modelId: 42,
      modelImageUrl: "https://legacy.example/model.png",
      readMode: "r6",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(captureSnapshotReadMode).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("seeds a linked session with the current selected full-body view", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 7,
      modelId: 42,
      modelImageUrl: "https://old.example/original.png",
    } as Awaited<ReturnType<typeof getSessionById>>);
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState("https://selected.example/current-body.png"),
    );

    await appRouter.createCaller(authCtx()).wardrobe.sessions.seedChat({
      sessionId: "91",
      modelImageUrl: "https://forged.example/substitute.png",
      resultUrl: "https://results.example/look.png",
    });

    expect(seedSession).toHaveBeenCalledWith(
      7,
      "91",
      "https://selected.example/current-body.png",
      "https://results.example/look.png",
      undefined,
    );
  });

  it("seeds an upload-only session with its durable captured image", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 7,
      modelId: null,
      modelImageUrl: "https://uploads.example/captured.png",
    } as Awaited<ReturnType<typeof getSessionById>>);

    await appRouter.createCaller(authCtx()).wardrobe.sessions.seedChat({
      sessionId: "91",
      modelImageUrl: "https://forged.example/substitute.png",
      resultUrl: "https://results.example/look.png",
    });

    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(seedSession).toHaveBeenCalledWith(
      7,
      "91",
      "https://uploads.example/captured.png",
      "https://results.example/look.png",
      undefined,
    );
  });

  it("refuses a foreign or malformed session without seeding", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 99,
      modelId: 42,
      modelImageUrl: "https://foreign.example/model.png",
    } as Awaited<ReturnType<typeof getSessionById>>);
    const caller = appRouter.createCaller(authCtx());

    await expect(caller.wardrobe.sessions.seedChat({
      sessionId: "91",
      modelImageUrl: "https://forged.example/substitute.png",
      resultUrl: "https://results.example/look.png",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.wardrobe.sessions.seedChat({
      sessionId: "not-a-database-session",
      modelImageUrl: "https://forged.example/substitute.png",
      resultUrl: "https://results.example/look.png",
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(seedSession).not.toHaveBeenCalled();
  });
});
