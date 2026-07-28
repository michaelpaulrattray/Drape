import { describe, expect, it, vi } from "vitest";
import {
  beginInkAddIntent,
  buildInkAuthorizationProviderConfig,
  readInkAddCapability,
} from "./inkAddIntent";
import {
  buildInkAuthorizationRequest,
} from "./composer/inkAuthorization";

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
  it("pins a non-thinking closed provider request without unsupported schema fields", () => {
    const config = buildInkAuthorizationProviderConfig(
      buildInkAuthorizationRequest("small black five-point star tattoo"),
    );
    expect(config).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        required: [
          "tattooOnly",
          "operationAdd",
          "singleFeature",
          "frontUpperTorsoCompatible",
          "containsPromptControl",
          "confidence",
        ],
      },
      thinkingConfig: {
        thinkingBudget: 0,
        includeThoughts: false,
      },
      maxOutputTokens: 4096,
    });
    expect(config.responseSchema).not.toHaveProperty("additionalProperties");
  });

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
    const warnAuthorizationUnknown = vi.fn();
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
      warnAuthorizationUnknown,
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
    expect(warnAuthorizationUnknown).not.toHaveBeenCalled();
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

  it("warns once only when authorization truth is unavailable", async () => {
    const warnAuthorizationUnknown = vi.fn();
    const begin = vi.fn();
    await expect(beginInkAddIntent(request, {
      enabledForUser: () => true,
      authorize: async () => ({
        ok: false,
        code: "authorization_unknown",
        recipeVersion: "ink.add.authorization.v1",
      }),
      warnAuthorizationUnknown,
      begin,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(warnAuthorizationUnknown).toHaveBeenCalledOnce();
    expect(warnAuthorizationUnknown).toHaveBeenCalledWith({
      userId: 7,
      modelId: 14,
      provider: null,
    });
    expect(begin).not.toHaveBeenCalled();

    warnAuthorizationUnknown.mockClear();
    await expect(beginInkAddIntent(request, {
      enabledForUser: () => true,
      authorize: async () => ({
        ok: false,
        code: "unsupported_request",
        recipeVersion: "ink.add.authorization.v1",
      }),
      warnAuthorizationUnknown,
      begin,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(warnAuthorizationUnknown).not.toHaveBeenCalled();
  });

  it("returns a closed capability projection while D4 is not product-ready", async () => {
    await expect(readInkAddCapability(
      { userId: 7, modelId: 14 },
      { enabledForUser: () => false },
    )).resolves.toEqual({
      inkAdd: false,
      subjectStatus: "disabled",
      priceCredits: 350,
      targetView: "frontFull",
      placements: ["left", "centre", "right"],
      activeIntent: null,
    });
  });

  it("reports server-owned subject and active-candidate truth", async () => {
    const active = {
      id: "33333333-3333-4333-8333-333333333333",
      userId: 7,
      modelId: 14,
      side: "centre" as const,
      normalizedDescriptor: "fine-line orbit",
      sourceAssetId: 28,
      expectedStateVersion: 4,
      identitySnapshotId: "44444444-4444-4444-8444-444444444444",
      packageSnapshotId: "55555555-5555-4555-8555-555555555555",
      referencePlateId: null,
    };
    await expect(readInkAddCapability(
      { userId: 7, modelId: 14 },
      {
        enabledForUser: () => true,
        findActiveIntent: async () => active,
        inspectAvailability: async () => {
          throw new Error("active intent must win");
        },
        readCandidate: async () => ({
          candidateId: "66666666-6666-4666-8666-666666666666",
          candidateStatus: "ready",
          candidateDeliveryUrl: "/api/evidence/candidate/66666666-6666-4666-8666-666666666666",
          expiresAt: "2026-08-27T00:00:00.000Z",
        }),
      },
    )).resolves.toMatchObject({
      inkAdd: true,
      subjectStatus: "active",
      activeIntent: {
        description: "fine-line orbit",
        side: "centre",
        candidateStatus: "ready",
      },
    });

    await expect(readInkAddCapability(
      { userId: 7, modelId: 14 },
      {
        enabledForUser: () => true,
        findActiveIntent: async () => null,
        inspectAvailability: async () => "feature_selected",
      },
    )).resolves.toMatchObject({
      inkAdd: true,
      subjectStatus: "feature_selected",
      activeIntent: null,
    });
  });
});
