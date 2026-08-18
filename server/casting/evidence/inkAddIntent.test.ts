import { describe, expect, it, vi } from "vitest";
import {
  beginInkAnywhereIntent,
  buildInkAuthorizationProviderConfig,
  buildInkInstructionProviderConfig,
  readInkAddCapability,
} from "./inkAddIntent";
import {
  buildInkAuthorizationRequest,
} from "./composer/inkAuthorization";
import { buildInkInstructionPlanningRequest } from "./inkInstructionPlanner";

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

  it("pins the v2 closed anatomy classifier schema", () => {
    const config = buildInkInstructionProviderConfig(
      buildInkInstructionPlanningRequest(
        "Add a blackwork full sleeve to his right arm",
      ),
    );
    expect(config).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          zone: { type: "STRING" },
          surface: { type: "STRING" },
          side: { type: "STRING" },
        },
        required: [
          "tattooOnly",
          "operationAdd",
          "singleFeature",
          "ambiguousAnatomy",
          "containsPromptControl",
          "zone",
          "surface",
          "side",
          "confidence",
        ],
      },
      thinkingConfig: {
        thinkingBudget: 0,
        includeThoughts: false,
      },
    });
  });

  /*
   * The three tests below were written against `beginInkAddIntent` — the
   * placement-picker intent the instruction road superseded, removed by the
   * cleanup milestone (2026-08-18). They are RE-POINTED rather than deleted,
   * because each drives a branch that exists in the LIVE function and was
   * covered nowhere else: the flag door, the operation replay, and warn-once
   * on unavailable authorization truth. Deleting the dead road's tests would
   * have taken three live branches' only coverage with it.
   */

  it("keeps the product door closed before any planner or operation work", async () => {
    const plan = vi.fn();
    const begin = vi.fn();
    await expect(beginInkAnywhereIntent({
      userId: 7,
      modelId: 14,
      instruction: "Add a blackwork full sleeve to his right arm",
      clientRequestId: request.clientRequestId,
    }, {
      enabledForUser: () => false,
      plan,
      begin,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(plan).not.toHaveBeenCalled();
    expect(begin).not.toHaveBeenCalled();
  });

  it("replays the intent id without another database mutation", async () => {
    const commit = vi.fn();
    await expect(beginInkAnywhereIntent({
      userId: 7,
      modelId: 14,
      instruction: "Add a blackwork full sleeve to his right arm",
      clientRequestId: request.clientRequestId,
    }, {
      enabledForUser: () => true,
      plan: async () => ({
        ok: true,
        normalizedDescriptor: "Add a blackwork full sleeve to his right arm",
        anatomy: {
          zone: "full_arm",
          surface: "circumferential",
          side: "right",
        },
        locationLabel: "Right arm · full sleeve",
        recipeVersion: "ink.add.anywhere.authorization.v1",
      }),
      begin: async () => ({
        type: "replay",
        operationId: "22222222-2222-4222-8222-222222222222",
        result: {
          intentId: "33333333-3333-4333-8333-333333333333",
          sourceViewAngle: "frontFull",
          sourceAssetId: 28,
        },
      }),
      commit,
    })).resolves.toMatchObject({
      intentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("warns once only when authorization truth is unavailable", async () => {
    const warnAuthorizationUnknown = vi.fn();
    const begin = vi.fn();
    const ask = {
      userId: 7,
      modelId: 14,
      instruction: "Add a blackwork full sleeve to his right arm",
      clientRequestId: request.clientRequestId,
    };

    await expect(beginInkAnywhereIntent(ask, {
      enabledForUser: () => true,
      plan: async () => ({
        ok: false,
        code: "authorization_unknown",
        recipeVersion: "ink.add.anywhere.authorization.v1",
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
    await expect(beginInkAnywhereIntent(ask, {
      enabledForUser: () => true,
      plan: async () => ({
        ok: false,
        code: "unsupported_request",
        recipeVersion: "ink.add.anywhere.authorization.v1",
      }),
      warnAuthorizationUnknown,
      begin,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(warnAuthorizationUnknown).not.toHaveBeenCalled();
  });

  it("plans a natural-language tuple before committing server-owned source authority", async () => {
    const plan = vi.fn(async () => ({
      ok: true as const,
      normalizedDescriptor: "Add a blackwork full sleeve to his right arm",
      anatomy: {
        zone: "full_arm" as const,
        surface: "circumferential" as const,
        side: "right" as const,
      },
      locationLabel: "Right arm · full sleeve",
      recipeVersion: "ink.add.anywhere.authorization.v1" as const,
    }));
    const begin = vi.fn(async () => ({
      type: "execute" as const,
      operationId: "22222222-2222-4222-8222-222222222222",
    }));
    const commit = vi.fn(async () => ({
      intentId: "33333333-3333-4333-8333-333333333333",
      sourceViewAngle: "frontFull",
      sourceAssetId: 28,
    }));
    await expect(beginInkAnywhereIntent({
      userId: 7,
      modelId: 14,
      instruction: "Add a blackwork full sleeve to his right arm",
      clientRequestId: request.clientRequestId,
    }, {
      enabledForUser: () => true,
      plan,
      begin,
      commit,
      generateId: () => "33333333-3333-4333-8333-333333333333",
    })).resolves.toEqual({
      intentId: "33333333-3333-4333-8333-333333333333",
      instruction: "Add a blackwork full sleeve to his right arm",
      locationLabel: "Right arm · full sleeve",
      priceCredits: 350,
      sourceViewLabel: "Full front",
    });
    expect(begin).toHaveBeenCalledWith({
      userId: 7,
      clientRequestId: request.clientRequestId,
      kind: "evidence_intent_begin",
      modelId: 14,
      payload: {
        modelId: 14,
        normalizedDescriptor: "Add a blackwork full sleeve to his right arm",
        anatomy: {
          zone: "full_arm",
          surface: "circumferential",
          side: "right",
        },
        recipeVersion: "ink.add.anywhere.authorization.v1",
      },
      lockKey: "model:14",
    });
    expect(commit).toHaveBeenCalledWith({
      userId: 7,
      modelId: 14,
      operationId: "22222222-2222-4222-8222-222222222222",
      intentId: "33333333-3333-4333-8333-333333333333",
      anatomy: {
        zone: "full_arm",
        surface: "circumferential",
        side: "right",
      },
      normalizedDescriptor: "Add a blackwork full sleeve to his right arm",
    });
  });

  it("refuses ambiguous all-body anatomy before claiming work", async () => {
    const begin = vi.fn();
    await expect(beginInkAnywhereIntent({
      userId: 7,
      modelId: 14,
      instruction: "Add a rose tattoo",
      clientRequestId: request.clientRequestId,
    }, {
      enabledForUser: () => true,
      plan: async () => ({
        ok: false,
        code: "ambiguous_anatomy",
        recipeVersion: "ink.add.anywhere.authorization.v1",
      }),
      begin,
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("exact body location"),
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it("refuses an uncalibrated tuple before claiming durable or paid work", async () => {
    const begin = vi.fn();
    await expect(beginInkAnywhereIntent({
      userId: 7,
      modelId: 14,
      instruction: "Add a black band tattoo to his left forearm",
      clientRequestId: request.clientRequestId,
    }, {
      enabledForUser: () => true,
      plan: async () => ({
        ok: true,
        normalizedDescriptor: "black band tattoo",
        anatomy: {
          zone: "forearm",
          surface: "circumferential",
          side: "left",
        },
        locationLabel: "Left forearm",
        recipeVersion: "ink.add.anywhere.authorization.v1",
      }),
      begin,
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("not yet safely supported"),
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it("returns a closed capability projection while D4 is not product-ready", async () => {
    await expect(readInkAddCapability(
      { userId: 7, modelId: 14 },
      { enabledForUser: () => false },
    )).resolves.toEqual({
      inkAdd: false,
      subjectStatus: "disabled",
      priceCredits: 350,
      activeIntent: null,
    });
  });

  it("reports server-owned subject and active-candidate truth", async () => {
    const active = {
      id: "33333333-3333-4333-8333-333333333333",
      userId: 7,
      modelId: 14,
      capabilityKey: "ink.add.front_upper_torso.v1" as const,
      activeCapabilityKey: "ink.add.front_upper_torso.v1" as const,
      ontologyVersion: "body-zones.front-upper-torso.v1",
      zone: "front_upper_torso",
      surface: "anterior",
      side: "centre" as const,
      normalizedDescriptor: "fine-line orbit",
      sourceAssetId: 28,
      sourceViewAngle: "frontFull" as const,
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
        sourceViewAngle: "frontFull",
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
