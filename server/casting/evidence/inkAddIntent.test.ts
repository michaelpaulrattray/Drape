import { describe, expect, it, vi } from "vitest";
import {
  beginInkAddIntent,
  readInkAddCapability,
} from "./inkAddIntent";

const request = {
  userId: 7,
  modelId: 14,
  sourceAssetId: 28,
  side: "left" as const,
  description: "  fine-line Gemini twins  ",
  clientRequestId: "11111111-1111-4111-8111-111111111111",
};

const authorization = {
  ok: true as const,
  normalizedDescriptor: "fine-line Gemini twins",
  recipeVersion: "ink.add.authorization.v1" as const,
};

describe("R7-7D D4A ink intent service", () => {
  it("keeps the product door closed before any classifier or operation work", async () => {
    const authorize = vi.fn();
    const begin = vi.fn();
    await expect(beginInkAddIntent(request, {
      enabledForUser: () => false,
      authorize,
      begin,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(authorize).not.toHaveBeenCalled();
    expect(begin).not.toHaveBeenCalled();
  });

  it("claims a normalized closed payload and commits the server-owned intent", async () => {
    const authorize = vi.fn(async () => authorization);
    const begin = vi.fn(async () => ({
      type: "execute" as const,
      operationId: "22222222-2222-4222-8222-222222222222",
    }));
    const commit = vi.fn(async () => ({
      intentId: "33333333-3333-4333-8333-333333333333",
    }));

    await expect(beginInkAddIntent(request, {
      enabledForUser: () => true,
      authorize,
      begin,
      commit,
      generateId: () => "33333333-3333-4333-8333-333333333333",
    })).resolves.toEqual({
      intentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(begin).toHaveBeenCalledWith({
      userId: 7,
      clientRequestId: request.clientRequestId,
      kind: "evidence_intent_begin",
      modelId: 14,
      payload: {
        modelId: 14,
        sourceAssetId: 28,
        side: "left",
        normalizedDescriptor: "fine-line Gemini twins",
      },
      lockKey: "model:14",
    });
    expect(commit).toHaveBeenCalledWith({
      userId: 7,
      modelId: 14,
      operationId: "22222222-2222-4222-8222-222222222222",
      intentId: "33333333-3333-4333-8333-333333333333",
      sourceAssetId: 28,
      side: "left",
      normalizedDescriptor: "fine-line Gemini twins",
    });
  });

  it("replays the closed intent id without another database mutation", async () => {
    const commit = vi.fn();
    await expect(beginInkAddIntent(request, {
      enabledForUser: () => true,
      authorize: async () => authorization,
      begin: async () => ({
        type: "replay",
        operationId: "22222222-2222-4222-8222-222222222222",
        result: { intentId: "33333333-3333-4333-8333-333333333333" },
      }),
      commit,
    })).resolves.toEqual({
      intentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("refuses an unsupported request before creating an operation", async () => {
    const begin = vi.fn();
    await expect(beginInkAddIntent(request, {
      enabledForUser: () => true,
      authorize: async () => ({
        ok: false,
        code: "unsupported_request",
        recipeVersion: "ink.add.authorization.v1",
      }),
      begin,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(begin).not.toHaveBeenCalled();
  });

  it("returns a closed capability projection while D4 is not product-ready", async () => {
    await expect(readInkAddCapability(
      { userId: 7, modelId: 14 },
      { enabledForUser: () => false },
    )).resolves.toEqual({
      inkAdd: false,
      priceCredits: 350,
      targetView: "frontFull",
      placements: ["left", "centre", "right"],
      activeIntent: null,
    });
  });
});
