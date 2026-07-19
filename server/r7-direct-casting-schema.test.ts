import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function authCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "r7-direct-schema",
      email: "r7-direct@example.com",
      name: "R7 Direct Schema",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("R7-1D direct Casting execute schemas", () => {
  it("requires a UUID clientRequestId on every direct and supporting writer", async () => {
    const caller = appRouter.createCaller(authCtx());
    const invalidCalls = [
      () => caller.models.create({ clientRequestId: "retry", preferences: {} } as never),
      () => caller.models.delete({ clientRequestId: "retry", modelId: 7 } as never),
      () => caller.generation.castingImage({ clientRequestId: "retry", modelId: 7 } as never),
      () => caller.generation.iterate({ clientRequestId: "retry", modelId: 7, assetId: 1, feedback: "lighting" } as never),
      () => caller.generation.mintPackage({ clientRequestId: "retry", modelId: 7, tier: "draft", characterName: "Name" } as never),
      () => caller.generation.refreshSlots({ clientRequestId: "retry", modelId: 7, angles: ["sideClose"] } as never),
      () => caller.generation.setSlotPinned({ clientRequestId: "retry", modelId: 7, angle: "sideClose", pinned: true } as never),
      () => caller.generation.restoreSlotVersion({ clientRequestId: "retry", modelId: 7, angle: "sideClose", assetId: 1 } as never),
      () => caller.generation.compactPrompt({ clientRequestId: "retry", modelId: 7 } as never),
      () => caller.boardOps.runGeneration.execute({ clientRequestId: "retry", boardId: 2, itemId: 3 } as never),
      () => caller.boardOps.applyModelEdit.execute({ clientRequestId: "retry", boardId: 2, itemId: 3, decision: "update", changes: {} } as never),
      () => caller.boardOps.runVariations.execute({ clientRequestId: "retry", boardId: 2, itemId: 3, count: 2 } as never),
    ];

    for (const call of invalidCalls) {
      await expect(call()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("keeps execute envelopes strict", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.castingImage({
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      modelId: 7,
      replayAnyway: true,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses duplicate refresh angles in both plan and execute before an operation can be claimed", async () => {
    const caller = appRouter.createCaller(authCtx());
    await expect(caller.generation.refreshSlotsPlan({
      modelId: 7,
      angles: ["sideClose", "sideClose"],
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Each view can only be refreshed once per request"),
    });

    await expect(caller.generation.refreshSlots({
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      modelId: 7,
      angles: ["sideClose", "sideClose"],
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Each view can only be refreshed once per request"),
    });
  });
});
