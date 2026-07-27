import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(userId = 77): TrpcContext {
  return {
    user: {
      id: userId,
      suspendedAt: null,
      lockedUntil: null,
    } as User,
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    correlationId: "r7-7d-d4a-route",
  };
}

describe("R7-7D D4A closed route boundary", () => {
  it("reports the closed capability without reading product state", async () => {
    await expect(
      appRouter.createCaller(context()).evidence.inkCapability({ modelId: 4 }),
    ).resolves.toEqual({
      inkAdd: false,
      priceCredits: 350,
      targetView: "frontFull",
      placements: ["left", "centre", "right"],
      activeIntent: null,
    });
  });

  it("refuses intent and reference mutations before provider, storage, or DB work", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.evidence.beginInkAddIntent({
      modelId: 4,
      sourceAssetId: 9,
      side: "left",
      description: "small fine-line star",
      clientRequestId: "11111111-1111-4111-8111-111111111111",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.evidence.attachInkIntentReference({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "33333333-3333-4333-8333-333333333333",
      imageDataUrl: "not-read",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("rejects forged authority and unknown placement at the strict wire", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.evidence.beginInkAddIntent({
      modelId: 4,
      sourceAssetId: 9,
      side: "left",
      description: "small fine-line star",
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      userId: 999,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.evidence.beginInkAddIntent({
      modelId: 4,
      sourceAssetId: 9,
      side: "shoulder",
      description: "small fine-line star",
      clientRequestId: "11111111-1111-4111-8111-111111111111",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
