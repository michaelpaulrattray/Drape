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
      subjectStatus: "disabled",
      priceCredits: 350,
      targetView: "frontFull",
      placements: ["left", "centre", "right"],
      activeIntent: null,
    });
  });

  it("refuses all intent, reference, and generation mutations while compile-closed", async () => {
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
    await expect(caller.evidence.generateInkAddCandidate({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "44444444-4444-4444-8444-444444444444",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.evidence.retryInkAddCandidate({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "55555555-5555-4555-8555-555555555555",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.evidence.acceptInkAddCandidate({
      candidateId: "66666666-6666-4666-8666-666666666666",
      clientRequestId: "77777777-7777-4777-8777-777777777777",
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.evidence.cancelInkAddIntent({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "88888888-8888-4888-8888-888888888888",
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
    await expect(caller.evidence.generateInkAddCandidate({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "44444444-4444-4444-8444-444444444444",
      userId: 999,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.evidence.retryInkAddCandidate({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "55555555-5555-4555-8555-555555555555",
      userId: 999,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.evidence.acceptInkAddCandidate({
      candidateId: "66666666-6666-4666-8666-666666666666",
      clientRequestId: "77777777-7777-4777-8777-777777777777",
      userId: 999,
      modelId: 4,
      publicStorageKey: "foreign/key.webp",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.evidence.cancelInkAddIntent({
      intentId: "22222222-2222-4222-8222-222222222222",
      clientRequestId: "88888888-8888-4888-8888-888888888888",
      userId: 999,
      modelId: 4,
      cleanupBatchId: "99999999-9999-4999-8999-999999999999",
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
