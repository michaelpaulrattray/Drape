import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createSession: vi.fn(),
    capUserSessions: vi.fn(),
    getSessionById: vi.fn(),
    getGarmentById: vi.fn(),
    createGeneration: vi.fn(),
    updateSession: vi.fn(),
  };
});

vi.mock("./casting/atomicCredits", () => ({
  withAtomicCredits: vi.fn(async (
    _input: unknown,
    work: () => Promise<unknown>,
  ) => work()),
}));

vi.mock("./db/dailyQuota", () => ({
  enforceDailyQuota: vi.fn(),
}));

vi.mock("./security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./security/rateLimit")>();
  return {
    ...actual,
    checkRateLimit: vi.fn().mockReturnValue({
      allowed: true,
      remaining: 10,
      resetIn: 0,
    }),
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

vi.mock("./wardrobe/vtoGeneration", () => ({
  generateVirtualTryOn: vi.fn(),
  incrementalComposite: vi.fn(),
}));

vi.mock("./wardrobe/garmentRefinement", () => ({
  refineGarment: vi.fn(),
}));

vi.mock("./wardrobe/identityCheck", () => ({
  checkIdentityMatch: vi.fn(),
}));

vi.mock("./wardrobe/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./wardrobe/utils")>();
  return {
    ...actual,
    getImageAspectBucket: vi.fn(),
  };
});

import {
  capUserSessions,
  createGeneration,
  createSession,
  getGarmentById,
  getSessionById,
  updateSession,
} from "./db";
import { withAtomicCredits } from "./casting/atomicCredits";
import { captureSnapshotReadMode } from "./casting/snapshotReadScope";
import { resolveEffectiveCastStateForRead } from "./casting/effectiveCastRead";
import {
  generateVirtualTryOn,
  incrementalComposite,
} from "./wardrobe/vtoGeneration";
import { refineGarment } from "./wardrobe/garmentRefinement";
import { checkIdentityMatch } from "./wardrobe/identityCheck";
import { getImageAspectBucket } from "./wardrobe/utils";
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
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 7,
      modelId: 42,
      modelImageUrl: "https://old.example/original.png",
      history: [],
      historyIndex: 0,
      activeGarmentIds: [],
      tattooMapData: null,
      styleNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(currentState());
    vi.mocked(getGarmentById).mockResolvedValue({
      id: 3,
      userId: 7,
      slotType: "tops",
      shortName: "Black jacket",
      description: "A black jacket",
      tags: [],
      isolatedImageUrl: "https://garments.example/jacket.png",
      originalImageUrl: "https://garments.example/original.png",
      sourceImageUrl: null,
      status: "ready",
    } as Awaited<ReturnType<typeof getGarmentById>>);
    vi.mocked(createGeneration).mockResolvedValue({
      success: true,
      generationId: 501,
    });
    vi.mocked(updateSession).mockResolvedValue(undefined);
    vi.mocked(getImageAspectBucket).mockResolvedValue("3:4");
    vi.mocked(generateVirtualTryOn).mockResolvedValue({
      resultUrl: "https://results.example/full.png",
    });
    vi.mocked(incrementalComposite).mockResolvedValue({
      resultUrl: "https://results.example/incremental.png",
    });
    vi.mocked(refineGarment).mockResolvedValue({
      resultUrl: "https://results.example/refined.png",
    });
    vi.mocked(checkIdentityMatch).mockResolvedValue(true);
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
      modelImageUrl: "https://pub-test.r2.dev/7-models/upload-captured.png",
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
      "https://pub-test.r2.dev/7-models/upload-captured.png",
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

  it("uses the selected session-owned image for full VTO before paid work", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(resolveEffectiveCastStateForRead).mockResolvedValue(
      currentState("https://selected.example/current-body.png"),
    );

    const result = await appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://forged.example/substitute.png",
      garmentIds: [3],
      sessionId: 91,
    });

    expect(result).toEqual({ resultUrl: "https://results.example/full.png" });
    expect(getImageAspectBucket).toHaveBeenCalledWith(
      "https://selected.example/current-body.png",
    );
    expect(generateVirtualTryOn).toHaveBeenCalledWith(expect.objectContaining({
      modelImageUrl: "https://selected.example/current-body.png",
      sessionId: "91",
    }));
    expect(vi.mocked(resolveEffectiveCastStateForRead).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(createGeneration).mock.invocationCallOrder[0]);
    expect(vi.mocked(createGeneration).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(withAtomicCredits).mock.invocationCallOrder[0]);
    expect(vi.mocked(withAtomicCredits).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(generateVirtualTryOn).mock.invocationCallOrder[0]);
  });

  it("refuses missing snapshot session authority before generation or credits", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue(null);

    await expect(appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://forged.example/substitute.png",
      garmentIds: [3],
      sessionId: 91,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(getGarmentById).not.toHaveBeenCalled();
    expect(createGeneration).not.toHaveBeenCalled();
    expect(withAtomicCredits).not.toHaveBeenCalled();
    expect(getImageAspectBucket).not.toHaveBeenCalled();
    expect(generateVirtualTryOn).not.toHaveBeenCalled();
  });

  it("uses an upload session's durable image for full VTO", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 7,
      modelId: null,
      modelImageUrl: "https://pub-test.r2.dev/7-models/upload-captured.png",
    } as Awaited<ReturnType<typeof getSessionById>>);

    await appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://forged.example/substitute.png",
      garmentIds: [3],
      sessionId: 91,
    });

    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(generateVirtualTryOn).toHaveBeenCalledWith(expect.objectContaining({
      modelImageUrl: "https://pub-test.r2.dev/7-models/upload-captured.png",
    }));
  });

  it("refuses a legacy upload session outside the owned namespace before paid work", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    vi.mocked(getSessionById).mockResolvedValue({
      id: 91,
      userId: 7,
      modelId: null,
      modelImageUrl: "https://legacy-external.example/model.png",
    } as Awaited<ReturnType<typeof getSessionById>>);

    await expect(appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://forged.example/substitute.png",
      garmentIds: [3],
      sessionId: 91,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(createGeneration).not.toHaveBeenCalled();
    expect(withAtomicCredits).not.toHaveBeenCalled();
    expect(generateVirtualTryOn).not.toHaveBeenCalled();
  });

  it("uses the selected session-owned image for incremental VTO", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");

    await appRouter.createCaller(authCtx()).wardrobe.vto.incremental({
      previousResultUrl: "https://results.example/previous.png",
      modelImageUrl: "https://forged.example/substitute.png",
      changedGarmentIds: [3],
      changedSlots: ["tops"],
      allGarmentIds: [3],
      sessionId: 91,
    });

    expect(getImageAspectBucket).toHaveBeenCalledWith(
      "https://selected.example/front-full.png",
    );
    expect(incrementalComposite).toHaveBeenCalledWith(expect.objectContaining({
      modelImageUrl: "https://selected.example/front-full.png",
      sessionId: "91",
    }));
  });

  it("uses the selected session-owned image for refinement and identity checking", async () => {
    vi.mocked(captureSnapshotReadMode).mockReturnValue("snapshot");
    const caller = appRouter.createCaller(authCtx());

    await caller.wardrobe.vto.refine({
      currentResultUrl: "https://results.example/current.png",
      modelImageUrl: "https://forged.example/substitute.png",
      garmentId: 3,
      instruction: "Make the jacket more fitted",
      sessionId: 91,
    });
    await caller.wardrobe.vto.checkIdentity({
      modelImageUrl: "https://forged.example/substitute.png",
      resultImageUrl: "https://results.example/refined.png",
      sessionId: 91,
    });

    expect(refineGarment).toHaveBeenCalledWith(expect.objectContaining({
      modelImageUrl: "https://selected.example/front-full.png",
      sessionId: "91",
    }));
    expect(checkIdentityMatch).toHaveBeenCalledWith(
      "https://selected.example/front-full.png",
      "https://results.example/refined.png",
    );
  });

  it("preserves raw model-image inputs for all R6 execution paths", async () => {
    const caller = appRouter.createCaller(authCtx());

    await caller.wardrobe.vto.generate({
      modelImageUrl: "https://legacy.example/model.png",
      garmentIds: [3],
    });
    await caller.wardrobe.vto.checkIdentity({
      modelImageUrl: "https://legacy.example/model.png",
      resultImageUrl: "https://results.example/full.png",
    });

    expect(getSessionById).not.toHaveBeenCalled();
    expect(resolveEffectiveCastStateForRead).not.toHaveBeenCalled();
    expect(generateVirtualTryOn).toHaveBeenCalledWith(expect.objectContaining({
      modelImageUrl: "https://legacy.example/model.png",
      sessionId: "default",
    }));
    expect(checkIdentityMatch).toHaveBeenCalledWith(
      "https://legacy.example/model.png",
      "https://results.example/full.png",
    );
  });

  it("rejects client read authority on the paid VTO wire", async () => {
    await expect(appRouter.createCaller(authCtx()).wardrobe.vto.generate({
      modelImageUrl: "https://legacy.example/model.png",
      garmentIds: [3],
      readMode: "r6",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(captureSnapshotReadMode).not.toHaveBeenCalled();
    expect(createGeneration).not.toHaveBeenCalled();
    expect(withAtomicCredits).not.toHaveBeenCalled();
  });
});
